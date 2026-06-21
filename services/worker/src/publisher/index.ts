import { randomUUID } from "node:crypto";
import { workerConfig, type PublisherRouteConfig } from "../config.js";
import { pool } from "../db.js";
import { createDisabledPublisher } from "./disabled-publisher.js";
import { createFacebookPublisher } from "./facebook-publisher.js";
import { createLinkedInPublisher } from "./linkedin-publisher.js";
import { createMockPublisher } from "./mock-publisher.js";
import { createNostrPublisher } from "./nostr-publisher.js";
import { createXPublisher } from "./x-publisher.js";
import type {
  ClaimedPublicationJob,
  PublicationPublisher,
  PublisherPlatform,
} from "./types.js";
import { getPublisherErrorRawResponse } from "./types.js";

type PublicationRunResult = {
  runId: string;
  externalPostId: string;
};

type PublisherRegistry = Map<PublisherPlatform, PublicationPublisher>;

type PublisherRoutingEntry = {
  platform: PublisherPlatform;
  requestedMode: string;
  effectiveMode: string;
  component: string;
  safetyAckConfigured: boolean;
  safetyAckValid: boolean;
  accountConfigured: boolean;
  allowedJobIdConfigured: boolean;
  targetConfigured: boolean;
  targetUrn?: string;
  reason?: string;
};

function createPublisher(route: PublisherRouteConfig): PublicationPublisher {
  if (route.effectiveMode === "mock") {
    return createMockPublisher(route.platform);
  }

  if (route.effectiveMode === "real" && route.platform === "linkedin") {
    return createLinkedInPublisher({
      allowedJobId: route.allowedJobId,
      targetUrn: route.targetUrn,
    });
  }

  if (route.effectiveMode === "real" && route.platform === "nostr_longform") {
    return createNostrPublisher({
      allowedJobId: route.allowedJobId,
    });
  }

  if (route.effectiveMode === "real" && route.platform === "x") {
    return createXPublisher({
      allowedJobId: route.allowedJobId,
    });
  }

  if (route.effectiveMode === "real" && route.platform === "facebook") {
    return createFacebookPublisher({
      allowedJobId: route.allowedJobId,
    });
  }

  return createDisabledPublisher(
    route.platform,
    route.reason ?? "publisher_disabled",
  );
}

function createPublisherRegistry(): PublisherRegistry {
  const registry: PublisherRegistry = new Map();

  for (const route of Object.values(workerConfig.publisherRoutes)) {
    registry.set(route.platform, createPublisher(route));
  }

  return registry;
}

export function describePublisherRouting(): PublisherRoutingEntry[] {
  return Object.values(workerConfig.publisherRoutes).map((route) => {
    const publisher = createPublisher(route);

    return {
      platform: route.platform,
      requestedMode: route.requestedMode,
      effectiveMode: route.effectiveMode,
      component: publisher.component,
      safetyAckConfigured: route.safetyAckConfigured,
      safetyAckValid: route.safetyAckValid,
      accountConfigured: route.accountConfigured,
      allowedJobIdConfigured: route.allowedJobIdConfigured,
      targetConfigured: route.targetConfigured,
      targetUrn: route.targetUrn,
      reason: route.reason,
    };
  });
}

async function getReadyPublishers(registry: PublisherRegistry): Promise<PublisherRegistry> {
  const ready: PublisherRegistry = new Map();

  for (const [platform, publisher] of registry.entries()) {
    const readiness = await publisher.isReady();

    if (!readiness.ready) {
      console.warn(JSON.stringify({
        service: "relaypress-worker",
        component: "publisher-router",
        status: "skipped",
        platform,
        publisherMode: publisher.mode,
        publisherComponent: publisher.component,
        reason: readiness.reason ?? "publisher_not_ready",
        timestamp: new Date().toISOString(),
      }));
      continue;
    }

    ready.set(platform, publisher);
  }

  return ready;
}

async function claimApprovedJobsForPublisher(
  publisher: PublicationPublisher,
  limit: number,
): Promise<ClaimedPublicationJob[]> {
  if (!publisher.platform || limit <= 0) return [];

  const result = await pool.query<ClaimedPublicationJob>(
    `
      update publication_jobs
      set
        status = 'publishing',
        updated_at = now()
      where id in (
        select id
        from publication_jobs
        where status = 'approved'
          and external_post_id is null
          and published_at is null
          and platform = $2
          and ($3::varchar is null or id = $3)
        order by updated_at asc
        limit $1
        for update skip locked
      )
      returning id, platform, adapted_content
    `,
    [limit, publisher.platform, publisher.allowedJobId ?? null],
  );

  return result.rows;
}

async function claimApprovedJobs(registry: PublisherRegistry): Promise<ClaimedPublicationJob[]> {
  const jobs: ClaimedPublicationJob[] = [];
  let remaining = workerConfig.publisherBatchSize;

  for (const publisher of registry.values()) {
    if (remaining <= 0) break;

    const publisherLimit = Math.max(1, Math.trunc(publisher.maxJobsPerTick ?? remaining));
    const claimed = await claimApprovedJobsForPublisher(
      publisher,
      Math.min(remaining, publisherLimit),
    );

    jobs.push(...claimed);
    remaining -= claimed.length;
  }

  return jobs;
}

async function createStartedRun(job: ClaimedPublicationJob, publisher: PublicationPublisher): Promise<string> {
  const runId = randomUUID();

  await pool.query(
    `
      insert into publication_job_runs (
        id,
        job_id,
        platform,
        status,
        mode,
        started_at,
        raw_response
      ) values ($1, $2, $3, 'started', $4, now(), $5)
    `,
    [
      runId,
      job.id,
      job.platform,
      publisher.mode,
      {
        component: publisher.component,
        routedPlatform: job.platform,
        contentLength: job.adapted_content?.length ?? 0,
        constrainedToSingleJob: Boolean(publisher.allowedJobId),
        publisherTargetUrn: publisher.targetUrn,
      },
    ],
  );

  return runId;
}

async function markRunAsPublished(
  runId: string,
  job: ClaimedPublicationJob,
  publisher: PublicationPublisher,
  externalPostId: string,
  rawResponse: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `
      update publication_job_runs
      set
        status = 'published',
        external_post_id = $2,
        finished_at = now(),
        raw_response = $3
      where id = $1
    `,
    [
      runId,
      externalPostId,
      {
        ok: true,
        mode: publisher.mode,
        component: publisher.component,
        platform: job.platform,
        externalPostId,
        contentLength: job.adapted_content?.length ?? 0,
        publisherTargetUrn: publisher.targetUrn,
        publisherResponse: rawResponse,
      },
    ],
  );
}

async function markRunAsFailed(
  runId: string,
  job: ClaimedPublicationJob,
  publisher: PublicationPublisher,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const publisherRawResponse = getPublisherErrorRawResponse(error);

  await pool.query(
    `
      update publication_job_runs
      set
        status = 'failed',
        error_message = $2,
        finished_at = now(),
        raw_response = $3
      where id = $1
    `,
    [
      runId,
      message,
      {
        ok: false,
        mode: publisher.mode,
        component: publisher.component,
        platform: job.platform,
        error: message,
        contentLength: job.adapted_content?.length ?? 0,
        publisherTargetUrn: publisher.targetUrn,
        publisherResponse: publisherRawResponse,
      },
    ],
  );
}

async function markJobAsFailed(job: ClaimedPublicationJob, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);

  await pool.query(
    `
      update publication_jobs
      set
        status = 'failed',
        error_message = $2,
        updated_at = now()
      where id = $1 and status = 'publishing'
    `,
    [job.id, message],
  );
}

async function markJobAsPublished(
  job: ClaimedPublicationJob,
  publisher: PublicationPublisher,
): Promise<PublicationRunResult> {
  const runId = await createStartedRun(job, publisher);

  try {
    const publishResult = await publisher.publish(job);

    const result = await pool.query(
      `
        update publication_jobs
        set
          status = 'published',
          external_post_id = $2,
          published_at = now(),
          updated_at = now()
        where id = $1
          and status = 'publishing'
          and external_post_id is null
          and published_at is null
        returning id
      `,
      [job.id, publishResult.externalPostId],
    );

    if (result.rowCount === 0) {
      throw new Error("Publication job was already published or is no longer publishable");
    }

    await markRunAsPublished(runId, job, publisher, publishResult.externalPostId, publishResult.rawResponse);

    return { runId, externalPostId: publishResult.externalPostId };
  } catch (error) {
    await markRunAsFailed(runId, job, publisher, error);
    await markJobAsFailed(job, error);
    throw error;
  }
}

export async function processApprovedPublicationJobs(): Promise<number> {
  const registry = createPublisherRegistry();
  const readyPublishers = await getReadyPublishers(registry);
  const jobs = await claimApprovedJobs(readyPublishers);

  for (const job of jobs) {
    const publisher = readyPublishers.get(job.platform);

    if (!publisher) {
      await markJobAsFailed(job, new Error(`No ready publisher routed for platform: ${job.platform}`));
      continue;
    }

    try {
      const result = await markJobAsPublished(job, publisher);

      console.log(JSON.stringify({
        service: "relaypress-worker",
        component: publisher.component,
        status: "published",
        publisherMode: publisher.mode,
        jobId: job.id,
        runId: result.runId,
        platform: job.platform,
        externalPostId: result.externalPostId,
        contentLength: job.adapted_content?.length ?? 0,
        publisherTargetUrn: publisher.targetUrn,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({
        service: "relaypress-worker",
        component: publisher.component,
        status: "failed",
        publisherMode: publisher.mode,
        jobId: job.id,
        platform: job.platform,
        error: message,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  return jobs.length;
}

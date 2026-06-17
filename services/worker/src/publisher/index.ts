import { randomUUID } from "node:crypto";
import { workerConfig } from "../config.js";
import { pool } from "../db.js";
import { createMockPublisher } from "./mock-publisher.js";
import type {
  ClaimedPublicationJob,
  PlatformPublisherMode,
  PublicationPublisher,
  PublisherPlatform,
  PublisherRoute,
} from "./types.js";
import { getPublisherErrorRawResponse } from "./types.js";
import { createUnavailableRealPublisher } from "./unavailable-real-publisher.js";

type PublicationRunResult = {
  runId: string;
  externalPostId: string;
};

const PUBLISHER_PLATFORMS: PublisherPlatform[] = [
  "linkedin",
  "x",
  "facebook",
  "instagram",
  "nostr_longform",
];

const REAL_SAFETY_ACKS: Record<PublisherPlatform, string> = {
  linkedin: "I_UNDERSTAND_LINKEDIN_REAL_PUBLICATION",
  x: "I_UNDERSTAND_X_REAL_PUBLICATION",
  facebook: "I_UNDERSTAND_META_REAL_PUBLICATION",
  instagram: "I_UNDERSTAND_META_REAL_PUBLICATION",
  nostr_longform: "I_UNDERSTAND_NOSTR_REAL_PUBLICATION",
};

let legacyWarningLogged = false;

function warnLegacyPublisherModeOnce(): void {
  if (legacyWarningLogged || !process.env.PUBLISHER_MODE) return;
  legacyWarningLogged = true;

  console.warn(JSON.stringify({
    service: "relaypress-worker",
    component: "publisher-router",
    status: "deprecated_config",
    variable: "PUBLISHER_MODE",
    replacement: [
      "LINKEDIN_PUBLISHER_MODE",
      "X_PUBLISHER_MODE",
      "FACEBOOK_PUBLISHER_MODE",
      "INSTAGRAM_PUBLISHER_MODE",
      "NOSTR_PUBLISHER_MODE",
    ],
    legacyValue: workerConfig.legacyPublisherMode,
    timestamp: new Date().toISOString(),
  }));
}

function realPublisherReason(
  platform: PublisherPlatform,
  safetyAckConfigured: boolean,
): string {
  if (!safetyAckConfigured) {
    return `${platform} real publisher requires its dedicated safety acknowledgement`;
  }

  return `${platform} real publisher is intentionally unavailable in PR X0`;
}

function buildPublisherRoute(
  platform: PublisherPlatform,
  configuredMode: PlatformPublisherMode,
): PublisherRoute {
  if (configuredMode === "disabled") {
    return {
      platform,
      configuredMode,
      safetyAckConfigured: false,
      publisher: null,
    };
  }

  if (configuredMode === "mock") {
    return {
      platform,
      configuredMode,
      safetyAckConfigured: false,
      publisher: createMockPublisher(platform),
    };
  }

  const safetyAckConfigured = workerConfig.publisherSafetyAcks[platform] === REAL_SAFETY_ACKS[platform];

  return {
    platform,
    configuredMode,
    safetyAckConfigured,
    publisher: createUnavailableRealPublisher(
      platform,
      realPublisherReason(platform, safetyAckConfigured),
    ),
  };
}

export function buildPublisherRoutes(): PublisherRoute[] {
  warnLegacyPublisherModeOnce();

  return PUBLISHER_PLATFORMS.map((platform) =>
    buildPublisherRoute(platform, workerConfig.publisherModes[platform]));
}

async function claimApprovedJobs(
  platform: PublisherPlatform,
  limit: number,
): Promise<ClaimedPublicationJob[]> {
  if (limit <= 0) return [];

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
        order by updated_at asc
        limit $1
        for update skip locked
      )
      returning id, platform, adapted_content
    `,
    [limit, platform],
  );

  return result.rows;
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
        contentLength: job.adapted_content?.length ?? 0,
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

async function processRoute(
  route: PublisherRoute,
  remainingBatchSize: number,
): Promise<number> {
  const publisher = route.publisher;
  if (!publisher || remainingBatchSize <= 0) return 0;

  const readiness = await publisher.isReady();

  if (!readiness.ready) {
    console.warn(JSON.stringify({
      service: "relaypress-worker",
      component: "publisher-router",
      status: "skipped",
      reason: readiness.reason ?? "publisher_not_ready",
      platform: route.platform,
      configuredMode: route.configuredMode,
      publisherMode: publisher.mode,
      publisherComponent: publisher.component,
      safetyAckConfigured: route.safetyAckConfigured,
      timestamp: new Date().toISOString(),
    }));

    return 0;
  }

  const jobs = await claimApprovedJobs(route.platform, remainingBatchSize);

  for (const job of jobs) {
    try {
      const result = await markJobAsPublished(job, publisher);

      console.log(JSON.stringify({
        service: "relaypress-worker",
        component: publisher.component,
        status: "published",
        jobId: job.id,
        runId: result.runId,
        platform: job.platform,
        externalPostId: result.externalPostId,
        contentLength: job.adapted_content?.length ?? 0,
        publisherMode: publisher.mode,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({
        service: "relaypress-worker",
        component: publisher.component,
        status: "failed",
        jobId: job.id,
        platform: job.platform,
        error: message,
        publisherMode: publisher.mode,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  return jobs.length;
}

export async function processApprovedPublicationJobs(): Promise<number> {
  const routes = buildPublisherRoutes();
  let processed = 0;

  for (const route of routes) {
    const remainingBatchSize = Math.max(workerConfig.publisherBatchSize - processed, 0);
    if (remainingBatchSize === 0) break;
    processed += await processRoute(route, remainingBatchSize);
  }

  return processed;
}

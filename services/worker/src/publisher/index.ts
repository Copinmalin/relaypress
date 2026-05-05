import { randomUUID } from "node:crypto";
import { workerConfig } from "../config.js";
import { pool } from "../db.js";
import { createLinkedInPublisher } from "./linkedin-publisher.js";
import { createMockPublisher } from "./mock-publisher.js";
import type { ClaimedPublicationJob, PublicationPublisher } from "./types.js";

type PublicationRunResult = {
  runId: string;
  externalPostId: string;
};

function selectPublisher(): PublicationPublisher {
  if (workerConfig.publisherMode === "linkedin_real") {
    return createLinkedInPublisher();
  }

  return createMockPublisher();
}

async function claimApprovedJobs(publisher: PublicationPublisher): Promise<ClaimedPublicationJob[]> {
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
          and platform = any($2::varchar[])
        order by updated_at asc
        limit $1
        for update skip locked
      )
      returning id, platform, adapted_content
    `,
    [workerConfig.publisherBatchSize, publisher.supportedPlatforms],
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
  const publisher = selectPublisher();
  const readiness = publisher.isReady();

  if (!readiness.ready) {
    console.warn(JSON.stringify({
      service: "relaypress-worker",
      component: "publisher-orchestrator",
      status: "skipped",
      reason: readiness.reason ?? "publisher_not_ready",
      publisherMode: workerConfig.publisherMode,
      publisherComponent: publisher.component,
      timestamp: new Date().toISOString(),
    }));

    return 0;
  }

  const jobs = await claimApprovedJobs(publisher);

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
        timestamp: new Date().toISOString(),
      }));
    }
  }

  return jobs.length;
}

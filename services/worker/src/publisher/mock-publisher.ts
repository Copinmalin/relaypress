import { randomUUID } from "node:crypto";
import { workerConfig } from "../config.js";
import { pool } from "../db.js";

type ClaimedPublicationJob = {
  id: string;
  platform: string;
  adapted_content: string | null;
};

type PublicationRunResult = {
  runId: string;
  externalPostId: string;
};

function externalPostIdFor(job: ClaimedPublicationJob): string {
  return `mock:${job.platform}:${job.id}`;
}

async function claimApprovedJobs(): Promise<ClaimedPublicationJob[]> {
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
        order by updated_at asc
        limit $1
        for update skip locked
      )
      returning id, platform, adapted_content
    `,
    [workerConfig.publisherBatchSize],
  );

  return result.rows;
}

async function createStartedRun(job: ClaimedPublicationJob): Promise<string> {
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
      workerConfig.publisherMode,
      {
        contentLength: job.adapted_content?.length ?? 0,
      },
    ],
  );

  return runId;
}

async function markRunAsPublished(
  runId: string,
  job: ClaimedPublicationJob,
  externalPostId: string,
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
        mode: workerConfig.publisherMode,
        platform: job.platform,
        externalPostId,
        contentLength: job.adapted_content?.length ?? 0,
      },
    ],
  );
}

async function markRunAsFailed(
  runId: string,
  job: ClaimedPublicationJob,
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
        mode: workerConfig.publisherMode,
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

async function markJobAsPublished(job: ClaimedPublicationJob): Promise<PublicationRunResult> {
  const runId = await createStartedRun(job);
  const externalPostId = externalPostIdFor(job);

  try {
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
      [job.id, externalPostId],
    );

    if (result.rowCount === 0) {
      throw new Error("Publication job was already published or is no longer publishable");
    }

    await markRunAsPublished(runId, job, externalPostId);

    return { runId, externalPostId };
  } catch (error) {
    await markRunAsFailed(runId, job, error);
    await markJobAsFailed(job, error);
    throw error;
  }
}

export async function processApprovedPublicationJobs(): Promise<number> {
  if (workerConfig.publisherMode !== "mock") {
    console.warn(JSON.stringify({
      service: "relaypress-worker",
      component: "mock-publisher",
      status: "skipped",
      reason: "PUBLISHER_MODE is not mock",
      publisherMode: workerConfig.publisherMode,
      timestamp: new Date().toISOString(),
    }));

    return 0;
  }

  const jobs = await claimApprovedJobs();

  for (const job of jobs) {
    const result = await markJobAsPublished(job);

    console.log(JSON.stringify({
      service: "relaypress-worker",
      component: "mock-publisher",
      status: "published",
      jobId: job.id,
      runId: result.runId,
      platform: job.platform,
      externalPostId: result.externalPostId,
      contentLength: job.adapted_content?.length ?? 0,
      timestamp: new Date().toISOString(),
    }));
  }

  return jobs.length;
}

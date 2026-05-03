import { workerConfig } from "../config.js";
import { pool } from "../db.js";

type ApprovedPublicationJob = {
  id: string;
  platform: string;
  adapted_content: string | null;
};

function externalPostIdFor(job: ApprovedPublicationJob): string {
  return `mock:${job.platform}:${job.id}`;
}

async function findApprovedJobs(): Promise<ApprovedPublicationJob[]> {
  const result = await pool.query<ApprovedPublicationJob>(
    `
      select id, platform, adapted_content
      from publication_jobs
      where status = 'approved'
      order by updated_at asc
      limit $1
    `,
    [workerConfig.publisherBatchSize],
  );

  return result.rows;
}

async function markJobAsPublished(job: ApprovedPublicationJob): Promise<void> {
  await pool.query(
    `
      update publication_jobs
      set
        status = 'published',
        external_post_id = $2,
        published_at = now(),
        updated_at = now()
      where id = $1 and status = 'approved'
    `,
    [job.id, externalPostIdFor(job)],
  );
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

  const jobs = await findApprovedJobs();

  for (const job of jobs) {
    await markJobAsPublished(job);

    console.log(JSON.stringify({
      service: "relaypress-worker",
      component: "mock-publisher",
      status: "published",
      jobId: job.id,
      platform: job.platform,
      externalPostId: externalPostIdFor(job),
      contentLength: job.adapted_content?.length ?? 0,
      timestamp: new Date().toISOString(),
    }));
  }

  return jobs.length;
}

#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORKER_WAS_RUNNING="$(docker compose ps --status running --services | grep -x worker || true)"
TMP_FILE="$(mktemp)"
BLOCKED_X_ID=""

cleanup() {
  set +e

  if [[ -s "$TMP_FILE" || -n "$BLOCKED_X_ID" ]]; then
    JOB_SPEC="$(awk -F '\t' 'NF == 2 { printf "%s:%s,", $1, $2 }' "$TMP_FILE")"
    if [[ -n "$BLOCKED_X_ID" ]]; then
      JOB_SPEC+="x_blocked:${BLOCKED_X_ID},"
    fi

    docker compose exec -T -e JOB_SPEC="$JOB_SPEC" api node <<'NODE'
const base = "http://127.0.0.1:3000";
const token = process.env.ADMIN_API_TOKEN;
const ids = String(process.env.JOB_SPEC ?? "")
  .split(",")
  .map((entry) => entry.split(":").slice(1).join(":"))
  .filter(Boolean);

for (const id of ids) {
  await fetch(`${base}/publication-jobs/${encodeURIComponent(id)}/archive`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}
NODE
  fi

  rm -f "$TMP_FILE"

  if [[ -n "$WORKER_WAS_RUNNING" ]]; then
    docker compose up -d worker >/dev/null
  fi
}

trap cleanup EXIT

docker compose stop worker >/dev/null

# Avoid touching pre-existing approved jobs. The smoke test is intentionally
# isolated and refuses to run until the staging review queue is clear.
docker compose exec -T api node <<'NODE'
const base = "http://127.0.0.1:3000";
const token = process.env.ADMIN_API_TOKEN;
const response = await fetch(`${base}/publication-jobs?status=approved&limit=100`, {
  headers: { Authorization: `Bearer ${token}` },
});
const payload = await response.json();
if (!response.ok) throw new Error(JSON.stringify(payload));
if (payload.count > 0) {
  throw new Error(`PR X0 smoke requires zero pre-existing approved jobs, found ${payload.count}`);
}
console.log("APPROVED_QUEUE_EMPTY=OK");
NODE

# Create one approved job per platform. The current manual-draft endpoint does not
# yet accept nostr_longform on this branch, so the Nostr fixture is inserted
# directly in PostgreSQL for this router-only smoke test.
docker compose exec -T api node <<'NODE' > "$TMP_FILE"
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const base = "http://127.0.0.1:3000";
const token = process.env.ADMIN_API_TOKEN;
const manualPlatforms = ["linkedin", "x", "facebook", "instagram"];
const marker = `PR-X0-${Date.now()}`;

async function api(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

const created = await api("/publication-jobs/manual-draft", {
  method: "POST",
  body: JSON.stringify({
    content: `${marker}\nSmoke routing multi-publishers, aucun appel reseau reel.`,
    platforms: manualPlatforms,
  }),
});

const nostrJobId = `manual:${randomUUID()}:nostr_longform`;
const nostrContent = `${marker}\nSmoke routing Nostr long-form, aucun appel relais reel.`;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(
    `
      insert into publication_jobs (
        id,
        source_event_id,
        platform,
        status,
        source_content,
        adapted_content,
        error_message,
        created_at,
        updated_at
      ) values ($1, null, 'nostr_longform', 'pending_review', $2, $2, null, now(), now())
    `,
    [nostrJobId, nostrContent],
  );
} finally {
  await client.end();
}

const jobs = [...created.jobs, { id: nostrJobId, platform: "nostr_longform" }];
for (const job of jobs) {
  await api(`/publication-jobs/${encodeURIComponent(job.id)}/approve`, { method: "POST" });
  process.stdout.write(`${job.platform}\t${job.id}\n`);
}
NODE

MOCK_RUN_OUTPUT="$(
  docker compose run --rm -T --no-deps \
    -e SOURCE_INGESTION_ENABLED=false \
    -e PUBLISHER_BATCH_SIZE=10 \
    -e PUBLISHER_MODE=linkedin_real \
    -e LINKEDIN_PUBLISHER_MODE=mock \
    -e X_PUBLISHER_MODE=mock \
    -e FACEBOOK_PUBLISHER_MODE=mock \
    -e INSTAGRAM_PUBLISHER_MODE=disabled \
    -e NOSTR_PUBLISHER_MODE=mock \
    worker node --input-type=module <<'NODE'
import { initializeDatabase } from "./services/worker/dist/db.js";
import {
  describePublisherRouting,
  processApprovedPublicationJobs,
} from "./services/worker/dist/publisher/index.js";

await initializeDatabase();
console.log("ROUTING_PLAN");
console.log(JSON.stringify(describePublisherRouting(), null, 2));
const publishedJobs = await processApprovedPublicationJobs();
console.log(`PUBLISHED_JOBS=${publishedJobs}`);
NODE
)"

printf '%s\n' "$MOCK_RUN_OUTPUT"

grep -q 'PUBLISHED_JOBS=4' <<< "$MOCK_RUN_OUTPUT"
grep -q '"platform": "linkedin"' <<< "$MOCK_RUN_OUTPUT"
grep -q '"platform": "x"' <<< "$MOCK_RUN_OUTPUT"
grep -q '"platform": "facebook"' <<< "$MOCK_RUN_OUTPUT"
grep -q '"platform": "instagram"' <<< "$MOCK_RUN_OUTPUT"
grep -q '"platform": "nostr_longform"' <<< "$MOCK_RUN_OUTPUT"
grep -q '"requestedMode": "mock"' <<< "$MOCK_RUN_OUTPUT"

if grep -q 'real_publisher_not_enabled_in_pr_x0' <<< "$MOCK_RUN_OUTPUT"; then
  echo "Unexpected blocked real route during the mock phase" >&2
  exit 1
fi

JOB_SPEC="$(awk -F '\t' 'NF == 2 { printf "%s:%s,", $1, $2 }' "$TMP_FILE")"

docker compose exec -T -e JOB_SPEC="$JOB_SPEC" api node <<'NODE'
const base = "http://127.0.0.1:3000";
const token = process.env.ADMIN_API_TOKEN;
const entries = String(process.env.JOB_SPEC ?? "")
  .split(",")
  .filter(Boolean)
  .map((entry) => {
    const separator = entry.indexOf(":");
    return { platform: entry.slice(0, separator), id: entry.slice(separator + 1) };
  });

async function api(path) {
  const response = await fetch(base + path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(payload));
  return payload;
}

for (const entry of entries) {
  const { job } = await api(`/publication-jobs/${encodeURIComponent(entry.id)}`);

  if (entry.platform === "instagram") {
    if (job.status !== "approved" || job.externalPostId || job.publishedAt) {
      throw new Error(`Disabled Instagram job was claimed: ${JSON.stringify(job)}`);
    }
  } else {
    if (job.status !== "published") {
      throw new Error(`${entry.platform} mock job was not published: ${JSON.stringify(job)}`);
    }
    if (!String(job.externalPostId ?? "").startsWith(`mock:${entry.platform}:`)) {
      throw new Error(`${entry.platform} mock externalPostId is invalid: ${job.externalPostId}`);
    }
  }

  console.log("ROUTED_JOB_OK");
  console.log(JSON.stringify({
    platform: entry.platform,
    id: job.id,
    status: job.status,
    externalPostId: job.externalPostId,
  }, null, 2));
}
NODE

# Create a second approved X job and request a real mode. PR X0 must block it,
# claim zero jobs and leave the job approved without an external id.
BLOCKED_X_ID="$(
  docker compose exec -T api node <<'NODE'
const base = "http://127.0.0.1:3000";
const token = process.env.ADMIN_API_TOKEN;

async function api(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text);
  return text ? JSON.parse(text) : {};
}

const created = await api("/publication-jobs/manual-draft", {
  method: "POST",
  body: JSON.stringify({ content: `PR-X0-BLOCKED-${Date.now()}`, platforms: ["x"] }),
});
const job = created.jobs[0];
await api(`/publication-jobs/${encodeURIComponent(job.id)}/approve`, { method: "POST" });
console.log(job.id);
NODE
)"

BLOCKED_RUN_OUTPUT="$(
  docker compose run --rm -T --no-deps \
    -e SOURCE_INGESTION_ENABLED=false \
    -e PUBLISHER_BATCH_SIZE=10 \
    -e LINKEDIN_PUBLISHER_MODE=disabled \
    -e X_PUBLISHER_MODE=real \
    -e FACEBOOK_PUBLISHER_MODE=disabled \
    -e INSTAGRAM_PUBLISHER_MODE=disabled \
    -e NOSTR_PUBLISHER_MODE=disabled \
    worker node --input-type=module <<'NODE'
import { initializeDatabase } from "./services/worker/dist/db.js";
import {
  describePublisherRouting,
  processApprovedPublicationJobs,
} from "./services/worker/dist/publisher/index.js";

await initializeDatabase();
console.log("BLOCKED_ROUTING_PLAN");
console.log(JSON.stringify(describePublisherRouting(), null, 2));
const publishedJobs = await processApprovedPublicationJobs();
console.log(`BLOCKED_PUBLISHED_JOBS=${publishedJobs}`);
NODE
)"

printf '%s\n' "$BLOCKED_RUN_OUTPUT"

grep -q '"requestedMode": "real"' <<< "$BLOCKED_RUN_OUTPUT"
grep -q '"effectiveMode": "disabled"' <<< "$BLOCKED_RUN_OUTPUT"
grep -q 'real_publisher_not_enabled_in_pr_x0' <<< "$BLOCKED_RUN_OUTPUT"
grep -q 'BLOCKED_PUBLISHED_JOBS=0' <<< "$BLOCKED_RUN_OUTPUT"

docker compose exec -T -e JOB_ID="$BLOCKED_X_ID" api node <<'NODE'
const base = "http://127.0.0.1:3000";
const token = process.env.ADMIN_API_TOKEN;
const response = await fetch(`${base}/publication-jobs/${encodeURIComponent(process.env.JOB_ID)}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const { job } = await response.json();

if (job.status !== "approved" || job.externalPostId || job.publishedAt) {
  throw new Error(`Real-mode blocked job changed unexpectedly: ${JSON.stringify(job)}`);
}

console.log("REAL_MODE_BLOCKED_OK");
console.log(JSON.stringify({
  id: job.id,
  platform: job.platform,
  status: job.status,
  externalPostId: job.externalPostId,
  publishedAt: job.publishedAt,
}, null, 2));
NODE

echo "PR_X0_PUBLISHER_ROUTING_SMOKE=OK"

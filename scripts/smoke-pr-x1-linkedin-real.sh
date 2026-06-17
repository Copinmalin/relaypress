#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORKER_WAS_RUNNING="$(docker compose ps --status running --services | grep -x worker || true)"
ACCOUNT_ID=""
ALLOWED_JOB_ID=""
DECOY_JOB_ID=""
FAKE_SUBJECT=""

cleanup() {
  set +e

  if [[ -n "$ALLOWED_JOB_ID" ]]; then
    docker compose exec -T -e JOB_ID="$ALLOWED_JOB_ID" api node <<'NODE'
const base = "http://127.0.0.1:3000";
const token = process.env.ADMIN_API_TOKEN;
await fetch(`${base}/publication-jobs/${encodeURIComponent(process.env.JOB_ID)}/archive`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
}).catch(() => undefined);
NODE
  fi

  if [[ -n "$DECOY_JOB_ID" ]]; then
    docker compose exec -T -e JOB_ID="$DECOY_JOB_ID" api node <<'NODE'
const base = "http://127.0.0.1:3000";
const token = process.env.ADMIN_API_TOKEN;
await fetch(`${base}/publication-jobs/${encodeURIComponent(process.env.JOB_ID)}/archive`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
}).catch(() => undefined);
NODE
  fi

  if [[ -n "$ACCOUNT_ID" ]]; then
    docker compose exec -T -e ACCOUNT_ID="$ACCOUNT_ID" api node <<'NODE'
import { pool } from "./services/api/dist/db.js";
await pool.query("delete from publisher_accounts where id = $1", [process.env.ACCOUNT_ID]);
await pool.end();
NODE
  fi

  if [[ -n "$WORKER_WAS_RUNNING" ]]; then
    docker compose up -d worker >/dev/null
  fi
}

trap cleanup EXIT

docker compose stop worker >/dev/null

# The test must never consume editorial jobs that existed before the smoke.
docker compose exec -T api node <<'NODE'
const base = "http://127.0.0.1:3000";
const token = process.env.ADMIN_API_TOKEN;
const response = await fetch(`${base}/publication-jobs?status=approved&limit=100`, {
  headers: { Authorization: `Bearer ${token}` },
});
const payload = await response.json();
if (!response.ok) throw new Error(JSON.stringify(payload));
if (payload.count > 0) {
  throw new Error(`PR X1 smoke requires zero pre-existing approved jobs, found ${payload.count}`);
}
console.log("APPROVED_QUEUE_EMPTY=OK");
NODE

read -r ACCOUNT_ID ALLOWED_JOB_ID DECOY_JOB_ID FAKE_SUBJECT <<< "$(
  docker compose exec -T api node <<'NODE'
const base = "http://127.0.0.1:3000";
const token = process.env.ADMIN_API_TOKEN;
const fakeSubject = `relaypress-x1-${Date.now()}`;
const fakeToken = "relaypress-pr-x1-fake-token";
const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

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

const accountPayload = await api("/publisher-accounts", {
  method: "POST",
  body: JSON.stringify({
    provider: "linkedin",
    accountUrn: `urn:li:person:${fakeSubject}`,
    displayName: "RelayPress PR X1 Test",
    scopes: ["openid", "profile", "w_member_social"],
    accessToken: fakeToken,
    tokenExpiresAt,
  }),
});

async function createApprovedJob(label) {
  const created = await api("/publication-jobs/manual-draft", {
    method: "POST",
    body: JSON.stringify({
      content: `PR-X1-${label}-${Date.now()}\nPublication LinkedIn simulée, sans appel réel.`,
      platforms: ["linkedin"],
    }),
  });
  const job = created.jobs[0];
  await api(`/publication-jobs/${encodeURIComponent(job.id)}/approve`, { method: "POST" });
  return job.id;
}

const allowedJobId = await createApprovedJob("ALLOWED");
const decoyJobId = await createApprovedJob("DECOY");
process.stdout.write(`${accountPayload.account.id} ${allowedJobId} ${decoyJobId} ${fakeSubject}`);
NODE
)"

if [[ -z "$ACCOUNT_ID" || -z "$ALLOWED_JOB_ID" || -z "$DECOY_JOB_ID" || -z "$FAKE_SUBJECT" ]]; then
  echo "Failed to create PR X1 fixtures" >&2
  exit 1
fi

echo "FIXTURES_CREATED=OK"

INVALID_ACK_OUTPUT="$(
  docker compose run --rm -T --no-deps \
    -e SOURCE_INGESTION_ENABLED=false \
    -e LINKEDIN_PUBLISHER_MODE=real \
    -e LINKEDIN_REAL_SAFETY_ACK=WRONG_ACK \
    -e LINKEDIN_PUBLISHER_ACCOUNT_ID="$ACCOUNT_ID" \
    -e LINKEDIN_REAL_ALLOWED_JOB_ID="$ALLOWED_JOB_ID" \
    -e X_PUBLISHER_MODE=disabled \
    -e FACEBOOK_PUBLISHER_MODE=disabled \
    -e INSTAGRAM_PUBLISHER_MODE=disabled \
    -e NOSTR_PUBLISHER_MODE=disabled \
    worker node --input-type=module <<'NODE'
import { describePublisherRouting, processApprovedPublicationJobs } from "./services/worker/dist/publisher/index.js";
console.log(JSON.stringify(describePublisherRouting(), null, 2));
console.log(`INVALID_ACK_PUBLISHED_JOBS=${await processApprovedPublicationJobs()}`);
NODE
)"

printf '%s\n' "$INVALID_ACK_OUTPUT"
grep -q 'linkedin_real_safety_ack_missing_or_invalid' <<< "$INVALID_ACK_OUTPUT"
grep -q 'INVALID_ACK_PUBLISHED_JOBS=0' <<< "$INVALID_ACK_OUTPUT"

MISSING_ACCOUNT_OUTPUT="$(
  docker compose run --rm -T --no-deps \
    -e SOURCE_INGESTION_ENABLED=false \
    -e LINKEDIN_PUBLISHER_MODE=real \
    -e LINKEDIN_REAL_SAFETY_ACK=I_UNDERSTAND_LINKEDIN_REAL_PUBLICATION \
    -e LINKEDIN_PUBLISHER_ACCOUNT_ID= \
    -e LINKEDIN_REAL_ALLOWED_JOB_ID="$ALLOWED_JOB_ID" \
    -e X_PUBLISHER_MODE=disabled \
    -e FACEBOOK_PUBLISHER_MODE=disabled \
    -e INSTAGRAM_PUBLISHER_MODE=disabled \
    -e NOSTR_PUBLISHER_MODE=disabled \
    worker node --input-type=module <<'NODE'
import { describePublisherRouting, processApprovedPublicationJobs } from "./services/worker/dist/publisher/index.js";
console.log(JSON.stringify(describePublisherRouting(), null, 2));
console.log(`MISSING_ACCOUNT_PUBLISHED_JOBS=${await processApprovedPublicationJobs()}`);
NODE
)"

printf '%s\n' "$MISSING_ACCOUNT_OUTPUT"
grep -q 'linkedin_publisher_account_id_missing' <<< "$MISSING_ACCOUNT_OUTPUT"
grep -q 'MISSING_ACCOUNT_PUBLISHED_JOBS=0' <<< "$MISSING_ACCOUNT_OUTPUT"

MISSING_JOB_OUTPUT="$(
  docker compose run --rm -T --no-deps \
    -e SOURCE_INGESTION_ENABLED=false \
    -e LINKEDIN_PUBLISHER_MODE=real \
    -e LINKEDIN_REAL_SAFETY_ACK=I_UNDERSTAND_LINKEDIN_REAL_PUBLICATION \
    -e LINKEDIN_PUBLISHER_ACCOUNT_ID="$ACCOUNT_ID" \
    -e LINKEDIN_REAL_ALLOWED_JOB_ID= \
    -e X_PUBLISHER_MODE=disabled \
    -e FACEBOOK_PUBLISHER_MODE=disabled \
    -e INSTAGRAM_PUBLISHER_MODE=disabled \
    -e NOSTR_PUBLISHER_MODE=disabled \
    worker node --input-type=module <<'NODE'
import { describePublisherRouting, processApprovedPublicationJobs } from "./services/worker/dist/publisher/index.js";
console.log(JSON.stringify(describePublisherRouting(), null, 2));
console.log(`MISSING_JOB_PUBLISHED_JOBS=${await processApprovedPublicationJobs()}`);
NODE
)"

printf '%s\n' "$MISSING_JOB_OUTPUT"
grep -q 'linkedin_real_allowed_job_id_missing' <<< "$MISSING_JOB_OUTPUT"
grep -q 'MISSING_JOB_PUBLISHED_JOBS=0' <<< "$MISSING_JOB_OUTPUT"

REAL_SIMULATION_OUTPUT="$(
  docker compose run --rm -T --no-deps \
    -e SOURCE_INGESTION_ENABLED=false \
    -e PUBLISHER_BATCH_SIZE=10 \
    -e LINKEDIN_PUBLISHER_MODE=real \
    -e LINKEDIN_REAL_SAFETY_ACK=I_UNDERSTAND_LINKEDIN_REAL_PUBLICATION \
    -e LINKEDIN_PUBLISHER_ACCOUNT_ID="$ACCOUNT_ID" \
    -e LINKEDIN_REAL_ALLOWED_JOB_ID="$ALLOWED_JOB_ID" \
    -e LINKEDIN_API_BASE_URL=http://127.0.0.1:3100 \
    -e LINKEDIN_API_VERSION=202606 \
    -e LINKEDIN_USERINFO_URL=http://127.0.0.1:3100/userinfo \
    -e FAKE_LINKEDIN_SUBJECT="$FAKE_SUBJECT" \
    -e X_PUBLISHER_MODE=disabled \
    -e FACEBOOK_PUBLISHER_MODE=disabled \
    -e INSTAGRAM_PUBLISHER_MODE=disabled \
    -e NOSTR_PUBLISHER_MODE=disabled \
    worker node --input-type=module <<'NODE'
import { createServer } from "node:http";
import { initializeDatabase } from "./services/worker/dist/db.js";
import { describePublisherRouting, processApprovedPublicationJobs } from "./services/worker/dist/publisher/index.js";

const observed = {
  userInfoCalls: 0,
  postCalls: 0,
  request: null,
};

const server = createServer(async (request, response) => {
  const authorizationOk = request.headers.authorization === "Bearer relaypress-pr-x1-fake-token";

  if (request.method === "GET" && request.url === "/userinfo") {
    observed.userInfoCalls += 1;
    response.writeHead(authorizationOk ? 200 : 401, { "content-type": "application/json" });
    response.end(JSON.stringify(authorizationOk ? {
      sub: process.env.FAKE_LINKEDIN_SUBJECT,
      name: "RelayPress PR X1 Test",
    } : { message: "unauthorized" }));
    return;
  }

  if (request.method === "POST" && request.url === "/posts") {
    observed.postCalls += 1;
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    observed.request = {
      path: request.url,
      method: request.method,
      authorizationOk,
      linkedinVersion: request.headers["linkedin-version"],
      restliVersion: request.headers["x-restli-protocol-version"],
      contentType: request.headers["content-type"],
      body,
    };
    response.writeHead(authorizationOk ? 201 : 401, {
      "content-type": "application/json",
      "x-restli-id": "urn:li:share:9876543210",
    });
    response.end("{}");
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ message: "not_found" }));
});

await new Promise((resolve) => server.listen(3100, "127.0.0.1", resolve));
await initializeDatabase();

try {
  console.log("REAL_ROUTING_PLAN");
  console.log(JSON.stringify(describePublisherRouting(), null, 2));
  const publishedJobs = await processApprovedPublicationJobs();
  console.log(`REAL_SIMULATED_PUBLISHED_JOBS=${publishedJobs}`);

  if (publishedJobs !== 1) throw new Error(`Expected exactly one LinkedIn job, got ${publishedJobs}`);
  if (observed.userInfoCalls !== 1) throw new Error(`Expected one userinfo call, got ${observed.userInfoCalls}`);
  if (observed.postCalls !== 1) throw new Error(`Expected one posts call, got ${observed.postCalls}`);

  const request = observed.request;
  if (!request || request.path !== "/posts" || request.method !== "POST") throw new Error("Posts API request missing");
  if (!request.authorizationOk) throw new Error("LinkedIn authorization header was invalid");
  if (request.linkedinVersion !== "202606") throw new Error(`Unexpected Linkedin-Version: ${request.linkedinVersion}`);
  if (request.restliVersion !== "2.0.0") throw new Error(`Unexpected Rest.li version: ${request.restliVersion}`);
  if (request.body.author !== `urn:li:person:${process.env.FAKE_LINKEDIN_SUBJECT}`) throw new Error("Unexpected author URN");
  if (request.body.visibility !== "PUBLIC") throw new Error("Unexpected visibility");
  if (request.body.lifecycleState !== "PUBLISHED") throw new Error("Unexpected lifecycle state");
  if (request.body.distribution?.feedDistribution !== "MAIN_FEED") throw new Error("Unexpected feed distribution");
  if (typeof request.body.commentary !== "string" || request.body.commentary.length === 0) throw new Error("Commentary missing");

  console.log("LINKEDIN_REQUEST_OK");
  console.log(JSON.stringify({
    path: request.path,
    method: request.method,
    authorizationOk: request.authorizationOk,
    linkedinVersion: request.linkedinVersion,
    restliVersion: request.restliVersion,
    author: request.body.author,
    visibility: request.body.visibility,
    lifecycleState: request.body.lifecycleState,
    feedDistribution: request.body.distribution.feedDistribution,
    commentaryLength: request.body.commentary.length,
  }, null, 2));
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
NODE
)"

printf '%s\n' "$REAL_SIMULATION_OUTPUT"
grep -q '"effectiveMode": "real"' <<< "$REAL_SIMULATION_OUTPUT"
grep -q 'REAL_SIMULATED_PUBLISHED_JOBS=1' <<< "$REAL_SIMULATION_OUTPUT"
grep -q 'LINKEDIN_REQUEST_OK' <<< "$REAL_SIMULATION_OUTPUT"

docker compose exec -T \
  -e ALLOWED_JOB_ID="$ALLOWED_JOB_ID" \
  -e DECOY_JOB_ID="$DECOY_JOB_ID" \
  api node <<'NODE'
const base = "http://127.0.0.1:3000";
const token = process.env.ADMIN_API_TOKEN;

async function api(path) {
  const response = await fetch(base + path, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(payload));
  return payload;
}

const allowed = (await api(`/publication-jobs/${encodeURIComponent(process.env.ALLOWED_JOB_ID)}`)).job;
const decoy = (await api(`/publication-jobs/${encodeURIComponent(process.env.DECOY_JOB_ID)}`)).job;
const runs = (await api(`/publication-jobs/${encodeURIComponent(process.env.ALLOWED_JOB_ID)}/runs?order=desc`)).runs;

if (allowed.status !== "published") throw new Error(`Allowed job not published: ${JSON.stringify(allowed)}`);
if (allowed.externalPostId !== "urn:li:share:9876543210") throw new Error(`Unexpected external post id: ${allowed.externalPostId}`);
if (!allowed.publishedAt) throw new Error("Allowed job missing publishedAt");
if (decoy.status !== "approved" || decoy.externalPostId || decoy.publishedAt) {
  throw new Error(`Decoy job changed unexpectedly: ${JSON.stringify(decoy)}`);
}
if (!runs.length || runs[0].status !== "published" || runs[0].mode !== "real") {
  throw new Error(`LinkedIn audit run invalid: ${JSON.stringify(runs)}`);
}
const serializedRuns = JSON.stringify(runs);
if (serializedRuns.includes("relaypress-pr-x1-fake-token")) {
  throw new Error("Credential leaked into audit run");
}

console.log("LINKEDIN_JOB_ALLOWLIST_OK");
console.log(JSON.stringify({
  allowed: {
    id: allowed.id,
    status: allowed.status,
    externalPostId: allowed.externalPostId,
    publishedAt: allowed.publishedAt,
  },
  decoy: {
    id: decoy.id,
    status: decoy.status,
    externalPostId: decoy.externalPostId,
    publishedAt: decoy.publishedAt,
  },
  latestRun: {
    id: runs[0].id,
    status: runs[0].status,
    mode: runs[0].mode,
  },
}, null, 2));
NODE

echo "PR_X1_LINKEDIN_REAL_SIMULATION_SMOKE=OK"

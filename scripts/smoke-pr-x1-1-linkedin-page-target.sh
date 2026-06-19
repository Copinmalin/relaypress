#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORKER_WAS_RUNNING="$(docker compose ps --status running --services | grep -x worker || true)"
ACCOUNT_ID=""
JOB_ID=""
FAKE_SUBJECT=""
PAGE_URN="urn:li:organization:107402555"

cleanup() {
  set +e

  if [[ -n "$JOB_ID" ]]; then
    docker compose exec -T -e JOB_ID="$JOB_ID" api node <<'NODE'
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
  throw new Error(`PR X1.1 smoke requires zero pre-existing approved jobs, found ${payload.count}`);
}
console.log("APPROVED_QUEUE_EMPTY=OK");
NODE

read -r ACCOUNT_ID JOB_ID FAKE_SUBJECT <<< "$(
  docker compose exec -T api node <<'NODE'
const base = "http://127.0.0.1:3000";
const token = process.env.ADMIN_API_TOKEN;
const fakeSubject = `relaypress-x11-${Date.now()}`;
const fakeToken = "relaypress-pr-x11-fake-token";
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
    displayName: "RelayPress PR X1.1 Test",
    scopes: ["openid", "profile", "email", "w_member_social", "w_organization_social", "r_organization_admin"],
    accessToken: fakeToken,
    tokenExpiresAt,
  }),
});

const created = await api("/publication-jobs/manual-draft", {
  method: "POST",
  body: JSON.stringify({
    content: `PR-X1.1-PAGE-${Date.now()}\nPublication LinkedIn Page simulée, sans appel réel.`,
    platforms: ["linkedin"],
  }),
});
const job = created.jobs[0];
await api(`/publication-jobs/${encodeURIComponent(job.id)}/approve`, { method: "POST" });
process.stdout.write(`${accountPayload.account.id} ${job.id} ${fakeSubject}`);
NODE
)"

if [[ -z "$ACCOUNT_ID" || -z "$JOB_ID" || -z "$FAKE_SUBJECT" ]]; then
  echo "Failed to create PR X1.1 fixtures" >&2
  exit 1
fi

echo "FIXTURES_CREATED=OK"

PAGE_TARGET_OUTPUT="$(
  docker compose run --rm -T --no-deps \
    -e SOURCE_INGESTION_ENABLED=false \
    -e PUBLISHER_BATCH_SIZE=10 \
    -e LINKEDIN_PUBLISHER_MODE=real \
    -e LINKEDIN_REAL_SAFETY_ACK=I_UNDERSTAND_LINKEDIN_REAL_PUBLICATION \
    -e LINKEDIN_PUBLISHER_ACCOUNT_ID="$ACCOUNT_ID" \
    -e LINKEDIN_REAL_ALLOWED_JOB_ID="$JOB_ID" \
    -e LINKEDIN_PUBLISHER_TARGET_URN="$PAGE_URN" \
    -e LINKEDIN_API_BASE_URL=http://127.0.0.1:3100 \
    -e LINKEDIN_API_VERSION=202606 \
    -e LINKEDIN_USERINFO_URL=http://127.0.0.1:3100/userinfo \
    -e FAKE_LINKEDIN_SUBJECT="$FAKE_SUBJECT" \
    -e PAGE_URN="$PAGE_URN" \
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
  organizationAclCalls: 0,
  postCalls: 0,
  postRequest: null,
};

const server = createServer(async (request, response) => {
  const authorizationOk = request.headers.authorization === "Bearer relaypress-pr-x11-fake-token";

  if (request.method === "GET" && request.url === "/userinfo") {
    observed.userInfoCalls += 1;
    response.writeHead(authorizationOk ? 200 : 401, { "content-type": "application/json" });
    response.end(JSON.stringify(authorizationOk ? {
      sub: process.env.FAKE_LINKEDIN_SUBJECT,
      name: "RelayPress PR X1.1 Test",
    } : { message: "unauthorized" }));
    return;
  }

  if (request.method === "GET" && request.url?.startsWith("/organizationAcls")) {
    observed.organizationAclCalls += 1;
    const url = new URL(request.url, "http://127.0.0.1:3100");
    const organization = url.searchParams.get("organization");
    response.writeHead(authorizationOk ? 200 : 401, { "content-type": "application/json" });
    response.end(JSON.stringify(authorizationOk ? {
      elements: organization === process.env.PAGE_URN ? [{
        organization: process.env.PAGE_URN,
        state: "APPROVED",
        role: "ADMINISTRATOR",
      }] : [],
    } : { message: "unauthorized" }));
    return;
  }

  if (request.method === "POST" && request.url === "/posts") {
    observed.postCalls += 1;
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    observed.postRequest = {
      path: request.url,
      method: request.method,
      authorizationOk,
      linkedinVersion: request.headers["linkedin-version"],
      restliVersion: request.headers["x-restli-protocol-version"],
      body,
    };
    response.writeHead(authorizationOk ? 201 : 401, {
      "content-type": "application/json",
      "x-restli-id": "urn:li:share:9876543211",
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
  const plan = describePublisherRouting().find((route) => route.platform === "linkedin");
  console.log("PAGE_ROUTING_PLAN");
  console.log(JSON.stringify(plan, null, 2));

  if (!plan || plan.effectiveMode !== "real" || plan.targetUrn !== process.env.PAGE_URN) {
    throw new Error(`Unexpected page routing: ${JSON.stringify(plan)}`);
  }

  const publishedJobs = await processApprovedPublicationJobs();
  console.log(`PAGE_TARGET_PUBLISHED_JOBS=${publishedJobs}`);

  if (publishedJobs !== 1) throw new Error(`Expected exactly one LinkedIn job, got ${publishedJobs}`);
  if (observed.userInfoCalls !== 1) throw new Error(`Expected one userinfo call, got ${observed.userInfoCalls}`);
  if (observed.organizationAclCalls !== 1) throw new Error(`Expected one organization ACL call, got ${observed.organizationAclCalls}`);
  if (observed.postCalls !== 1) throw new Error(`Expected one posts call, got ${observed.postCalls}`);

  const post = observed.postRequest;
  if (!post || post.body.author !== process.env.PAGE_URN) throw new Error("Unexpected post author target");
  if (post.linkedinVersion !== "202606") throw new Error(`Unexpected Linkedin-Version: ${post.linkedinVersion}`);
  if (post.restliVersion !== "2.0.0") throw new Error(`Unexpected Rest.li version: ${post.restliVersion}`);

  console.log("LINKEDIN_PAGE_TARGET_REQUEST_OK");
  console.log(JSON.stringify({
    author: post.body.author,
    visibility: post.body.visibility,
    lifecycleState: post.body.lifecycleState,
    commentaryLength: post.body.commentary.length,
    organizationAclCalls: observed.organizationAclCalls,
  }, null, 2));
} finally {
  server.close();
}
NODE
)"

printf '%s\n' "$PAGE_TARGET_OUTPUT"
grep -q '"targetUrn": "urn:li:organization:107402555"' <<< "$PAGE_TARGET_OUTPUT"
grep -q 'PAGE_TARGET_PUBLISHED_JOBS=1' <<< "$PAGE_TARGET_OUTPUT"
grep -q 'LINKEDIN_PAGE_TARGET_REQUEST_OK' <<< "$PAGE_TARGET_OUTPUT"

POST_RUN_OUTPUT="$(
  docker compose exec -T -e JOB_ID="$JOB_ID" -e PAGE_URN="$PAGE_URN" api node <<'NODE'
const base = "http://127.0.0.1:3000";
const token = process.env.ADMIN_API_TOKEN;
const response = await fetch(`${base}/publication-jobs/${encodeURIComponent(process.env.JOB_ID)}/runs?order=desc`, {
  headers: { Authorization: `Bearer ${token}` },
});
const payload = await response.json();
if (!response.ok) throw new Error(JSON.stringify(payload));
const latest = payload.runs?.[0];
if (!latest || latest.mode !== "real" || latest.status !== "published") {
  throw new Error(`Unexpected run: ${JSON.stringify(latest)}`);
}
if (latest.rawResponse?.publisherResponse?.targetUrn !== process.env.PAGE_URN) {
  throw new Error(`Run did not record target URN: ${JSON.stringify(latest.rawResponse)}`);
}
console.log("LINKEDIN_PAGE_TARGET_RUN_OK");
NODE
)"

printf '%s\n' "$POST_RUN_OUTPUT"
grep -q 'LINKEDIN_PAGE_TARGET_RUN_OK' <<< "$POST_RUN_OUTPUT"

echo "PR_X1_1_LINKEDIN_PAGE_TARGET_SMOKE=OK"

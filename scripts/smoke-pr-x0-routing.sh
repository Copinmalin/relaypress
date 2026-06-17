#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

run_mock_routes() {
  docker compose exec -T \
    -e PUBLISHER_MODE= \
    -e LINKEDIN_PUBLISHER_MODE=mock \
    -e X_PUBLISHER_MODE=mock \
    -e FACEBOOK_PUBLISHER_MODE=mock \
    -e INSTAGRAM_PUBLISHER_MODE=disabled \
    -e NOSTR_PUBLISHER_MODE=mock \
    worker node --input-type=module <<'NODE'
import { buildPublisherRoutes } from "./services/worker/dist/publisher/index.js";

const expected = {
  linkedin: "mock",
  x: "mock",
  facebook: "mock",
  instagram: "disabled",
  nostr_longform: "mock",
};

const routes = buildPublisherRoutes();

for (const route of routes) {
  if (route.configuredMode !== expected[route.platform]) {
    throw new Error(`${route.platform}: expected ${expected[route.platform]}, got ${route.configuredMode}`);
  }

  if (route.configuredMode === "disabled") {
    if (route.publisher !== null) throw new Error(`${route.platform}: disabled route has a publisher`);
    continue;
  }

  if (!route.publisher) throw new Error(`${route.platform}: mock route has no publisher`);
  const readiness = await route.publisher.isReady();
  if (!readiness.ready) throw new Error(`${route.platform}: mock publisher is not ready`);
  if (route.publisher.mode !== `${route.platform}_mock`) {
    throw new Error(`${route.platform}: unexpected mock mode ${route.publisher.mode}`);
  }
  if (route.publisher.supportedPlatforms.length !== 1 || route.publisher.supportedPlatforms[0] !== route.platform) {
    throw new Error(`${route.platform}: publisher is not scoped to exactly one platform`);
  }
}

console.log("MOCK_ROUTES_OK");
console.log(JSON.stringify(routes.map((route) => ({
  platform: route.platform,
  configuredMode: route.configuredMode,
  publisherMode: route.publisher?.mode ?? null,
  ready: route.publisher ? true : null,
})), null, 2));
NODE
}

run_blocked_real_route() {
  docker compose exec -T \
    -e PUBLISHER_MODE= \
    -e LINKEDIN_PUBLISHER_MODE=real \
    -e X_PUBLISHER_MODE=disabled \
    -e FACEBOOK_PUBLISHER_MODE=disabled \
    -e INSTAGRAM_PUBLISHER_MODE=disabled \
    -e NOSTR_PUBLISHER_MODE=disabled \
    -e LINKEDIN_REAL_SAFETY_ACK=I_UNDERSTAND_LINKEDIN_REAL_PUBLICATION \
    worker node --input-type=module <<'NODE'
import { buildPublisherRoutes } from "./services/worker/dist/publisher/index.js";

const routes = buildPublisherRoutes();
const linkedin = routes.find((route) => route.platform === "linkedin");

if (!linkedin) throw new Error("LinkedIn route missing");
if (linkedin.configuredMode !== "real") throw new Error("LinkedIn route is not real");
if (!linkedin.safetyAckConfigured) throw new Error("LinkedIn safety ack was not recognized");
if (!linkedin.publisher) throw new Error("LinkedIn blocked publisher missing");

const readiness = await linkedin.publisher.isReady();
if (readiness.ready) throw new Error("PR X0 must not expose a ready real publisher");
if (!String(readiness.reason ?? "").includes("intentionally unavailable in PR X0")) {
  throw new Error(`Unexpected blocked reason: ${readiness.reason}`);
}

console.log("REAL_ROUTE_BLOCKED_OK");
console.log(JSON.stringify({
  platform: linkedin.platform,
  configuredMode: linkedin.configuredMode,
  safetyAckConfigured: linkedin.safetyAckConfigured,
  publisherMode: linkedin.publisher.mode,
  ready: readiness.ready,
  reason: readiness.reason,
}, null, 2));
NODE
}

run_mock_routes
run_blocked_real_route

echo "PR_X0_ROUTING_SMOKE=OK"

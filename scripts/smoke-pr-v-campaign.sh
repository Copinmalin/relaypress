#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

docker compose exec -T -e SIGNAL_ID="${SIGNAL_ID:-}" api node <<'NODE'
const base = "http://127.0.0.1:3000";
const token = process.env.ADMIN_API_TOKEN;
const platforms = ["linkedin", "x", "facebook", "nostr_longform"];

async function api(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(path + " failed: " + response.status + " " + text.slice(0, 500));
  return payload;
}

async function getSignalId() {
  if (process.env.SIGNAL_ID) return process.env.SIGNAL_ID;
  const payload = await api("/editorial-signals?status=ready_for_campaign&limit=1&order=desc");
  if (!payload.signals?.[0]) throw new Error("No ready_for_campaign signal found. Set SIGNAL_ID.");
  return payload.signals[0].id;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const signalId = await getSignalId();
console.log("SIGNAL_USED", signalId);

const campaign = await api("/editorial-signals/" + encodeURIComponent(signalId) + "/generate-campaign", {
  method: "POST",
  body: JSON.stringify({ platforms, mode: "openai", styleProfile: "bconseil_pro" }),
});

console.log("CAMPAIGN_SUMMARY");
console.log(JSON.stringify({
  signalId: campaign.signalId,
  generatedCount: campaign.generatedCount,
  failedCount: campaign.failedCount,
  reviewStatus: campaign.reviewStatus,
  publicationTriggered: campaign.publicationTriggered,
}, null, 2));

assert(campaign.generatedCount === 4, "Expected four generated formats");
assert(campaign.failedCount === 0, "Expected zero failed formats");
assert(campaign.reviewStatus === "pending_review", "Campaign must remain pending_review");
assert(campaign.publicationTriggered === false, "Campaign must not publish");

for (const platform of platforms) {
  const result = campaign.results.find((item) => item.platform === platform);
  assert(result, "Missing result for " + platform);
  assert(result.status === "generated", platform + " generation failed");
  assert(result.job.status === "pending_review", platform + " is not pending_review");
  assert(!result.job.externalPostId && !result.job.publishedAt, platform + " was published");

  const content = String(result.job.adaptedContent || "");
  assert(content.length > 0, platform + " content is empty");
  if (platform === "x") assert(content.length <= 140, "X exceeds 140 characters");
  if (platform === "nostr_longform") {
    assert(content.length > 1500, "Nostr long-form is not over 1500 characters");
    const lower = content.toLowerCase();
    const sections = ["contexte", "faits", "analyse", "implications", "limites", "sources"]
      .filter((name) => lower.includes(name));
    assert(sections.length >= 4, "Nostr long-form lacks visible sections");
  }

  console.log("FORMAT_OK");
  console.log(JSON.stringify({
    platform,
    jobId: result.jobId,
    status: result.job.status,
    length: content.length,
    warnings: result.warnings,
    preview: content.slice(0, 900),
  }, null, 2));
}

console.log("JOBS_LEFT_FOR_MANUAL_REVIEW");
console.log(JSON.stringify({ signalId, platforms }, null, 2));
console.log("PR_V_CAMPAIGN_SMOKE=OK");
NODE

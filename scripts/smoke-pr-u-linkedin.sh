#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SMOKE_CLEANUP="${SMOKE_CLEANUP:-0}"

docker compose exec -T \
  -e SMOKE_CLEANUP="$SMOKE_CLEANUP" \
  api node <<'NODE'
const base = "http://127.0.0.1:3000";
const token = process.env.ADMIN_API_TOKEN;
const shouldCleanup = process.env.SMOKE_CLEANUP === "1";

async function api(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 800) };
  }

  if (!res.ok) {
    throw new Error(`${path} failed with status ${res.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function main() {
  const sources = await api("/source-items?limit=1&order=desc");
  const source = sources.items?.[0];

  if (!source) throw new Error("no source item found");

  console.log("SOURCE_USED");
  console.log(JSON.stringify({
    id: source.id,
    status: source.status,
    provider: source.provider,
    title: source.title,
    canonicalUrl: source.canonicalUrl,
  }, null, 2));

  const content = [
    `Titre source : ${source.title}`,
    source.excerpt ? `Extrait source : ${source.excerpt}` : "",
    source.canonicalUrl ? `Source : ${source.canonicalUrl}` : "",
  ].filter(Boolean).join("\n");

  const created = await api("/publication-jobs/manual-draft", {
    method: "POST",
    body: JSON.stringify({ content, platforms: ["linkedin"] }),
  });

  const job = created.jobs?.[0];
  if (!job) throw new Error("no job created");

  console.log("JOB_CREATED");
  console.log(JSON.stringify({
    id: job.id,
    platform: job.platform,
    status: job.status,
  }, null, 2));

  const generated = await api(`/publication-jobs/${encodeURIComponent(job.id)}/generate`, {
    method: "POST",
    body: JSON.stringify({
      styleProfile: "bconseil_pro",
      outputFormat: "linkedin_bconseil_signal",
      instruction: [
        "Produire un brouillon LinkedIn B-Conseil vivant mais sobre.",
        "Choisir un seul angle fort.",
        "Donner la priorite a la culture Bitcoin, la souverainete, la liberte, l'open-source, l'autonomie, l'information et la formation.",
        "Ne traiter la finance ou la speculation que si la source l'impose explicitement.",
        "Ecrire une publication directe sans titres de rubriques visibles.",
        "Ajouter un CTA contextualise vers copinmalin.top pour decouvrir, s'informer ou se former.",
        "Ne pas ajouter de chiffres absents de la source.",
        "Mettre les incertitudes dans claims_requiring_human_review.",
        "Ne pas donner de conseil financier.",
      ].join(" "),
    }),
  });

  const updated = generated.job;
  const adapted = String(updated.adaptedContent ?? "");

  console.log("JOB_GENERATED");
  console.log(JSON.stringify({
    responseMode: generated.mode,
    responseModel: generated.model,
    generation: generated.generation,
    jobStatus: updated.status,
    errorMessage: updated.errorMessage ?? null,
    generationMode: updated.generationMode ?? null,
    generationModel: updated.generationModel ?? null,
    externalPostId: updated.externalPostId ?? null,
    publishedAt: updated.publishedAt ?? null,
    adaptedLength: adapted.length,
    preview: adapted.slice(0, 2000),
  }, null, 2));

  if (generated.mode !== "openai") throw new Error("expected responseMode=openai");
  if (updated.generationMode !== "openai") throw new Error("expected generationMode=openai");
  if (updated.status !== "pending_review") throw new Error(`expected pending_review, got ${updated.status}`);
  if (updated.externalPostId || updated.publishedAt) throw new Error("generation published something");
  if (!adapted.trim()) throw new Error("empty adapted content");

  if (shouldCleanup) {
    const archived = await api(`/publication-jobs/${encodeURIComponent(job.id)}/archive`, {
      method: "POST",
    });

    console.log("JOB_ARCHIVED_BY_EXPLICIT_CLEANUP");
    console.log(JSON.stringify({ id: archived.job.id, status: archived.job.status }, null, 2));
  } else {
    console.log("JOB_LEFT_FOR_MANUAL_REVIEW");
    console.log(JSON.stringify({
      id: job.id,
      status: updated.status,
      nextActions: ["modify", "approve", "reject", "archive"],
    }, null, 2));
  }

  console.log("PR_U_LK_SMOKE=OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE

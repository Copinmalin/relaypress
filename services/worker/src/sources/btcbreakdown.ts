import { randomUUID } from "node:crypto";
import { workerConfig } from "../config.js";
import { pool } from "../db.js";

type BtcBreakdownCandidate = {
  sourceUrl: string;
  title?: string;
  excerpt?: string;
};

type BtcBreakdownSourceItem = {
  sourceUrl: string;
  canonicalUrl: string;
  title: string;
  excerpt?: string;
};

const PROVIDER = "btcbreakdown";
const DEFAULT_LANGUAGE = "en";
const MAX_TITLE_LENGTH = 300;
const MAX_EXCERPT_LENGTH = 500;

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x")) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    if (entity.startsWith("#")) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return namedEntities[entity] ?? match;
  });
}

function normalizeWhitespace(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string): string {
  return normalizeWhitespace(value.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function clipText(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;

  const normalized = normalizeWhitespace(value);
  if (!normalized) return undefined;

  if (normalized.length <= maxLength) return normalized;

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeUrl(value: string, baseUrl: string): string | undefined {
  try {
    const url = new URL(value, baseUrl);
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

function isBtcBreakdownPostUrl(value: string, baseUrl: string): boolean {
  const candidate = new URL(value);
  const base = new URL(baseUrl);

  return candidate.hostname === base.hostname && candidate.pathname.startsWith("/p/");
}

function extractMetaContent(html: string, matcher: RegExp): string | undefined {
  const match = matcher.exec(html);
  if (!match?.[1]) return undefined;

  return clipText(match[1], MAX_EXCERPT_LENGTH);
}

function extractMetaProperty(html: string, property: string): string | undefined {
  return extractMetaContent(
    html,
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
  ) ?? extractMetaContent(
    html,
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`, "i"),
  );
}

function extractMetaName(html: string, name: string): string | undefined {
  return extractMetaContent(
    html,
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
  ) ?? extractMetaContent(
    html,
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["'][^>]*>`, "i"),
  );
}

function extractCanonicalUrl(html: string, sourceUrl: string, baseUrl: string): string {
  const match = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i.exec(html)
    ?? /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i.exec(html);

  const canonicalUrl = match?.[1] ? normalizeUrl(match[1], baseUrl) : undefined;

  if (canonicalUrl && isBtcBreakdownPostUrl(canonicalUrl, baseUrl)) {
    return canonicalUrl;
  }

  return sourceUrl;
}

function extractTitle(html: string): string | undefined {
  const ogTitle = extractMetaProperty(html, "og:title") ?? extractMetaName(html, "twitter:title");
  if (ogTitle) return clipText(ogTitle, MAX_TITLE_LENGTH);

  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  return clipText(title ? stripHtml(title) : undefined, MAX_TITLE_LENGTH);
}

function extractExcerpt(html: string): string | undefined {
  return extractMetaProperty(html, "og:description")
    ?? extractMetaName(html, "description")
    ?? extractMetaName(html, "twitter:description");
}

function extractCandidates(html: string, baseUrl: string, limit: number): BtcBreakdownCandidate[] {
  const candidates = new Map<string, BtcBreakdownCandidate>();
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorRegex)) {
    const href = match[1];
    const anchorBody = match[2] ?? "";
    const sourceUrl = normalizeUrl(href, baseUrl);

    if (!sourceUrl || !isBtcBreakdownPostUrl(sourceUrl, baseUrl)) continue;
    if (candidates.has(sourceUrl)) continue;

    const title = clipText(stripHtml(anchorBody), MAX_TITLE_LENGTH);
    candidates.set(sourceUrl, { sourceUrl, title });

    if (candidates.size >= limit) break;
  }

  return [...candidates.values()];
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent": "RelayPress Source Ingestion/0.1 (+https://github.com/Copinmalin/relaypress)",
    },
  });

  if (!response.ok) {
    throw new Error(`BTC Breakdown fetch failed with status ${response.status}`);
  }

  return response.text();
}

async function fetchSourceItem(candidate: BtcBreakdownCandidate, baseUrl: string): Promise<BtcBreakdownSourceItem> {
  try {
    const html = await fetchText(candidate.sourceUrl);
    const title = extractTitle(html) ?? candidate.title;

    if (!title) {
      throw new Error("BTC Breakdown item title not found");
    }

    return {
      sourceUrl: candidate.sourceUrl,
      canonicalUrl: extractCanonicalUrl(html, candidate.sourceUrl, baseUrl),
      title,
      excerpt: extractExcerpt(html) ?? candidate.excerpt,
    };
  } catch (error) {
    if (!candidate.title) throw error;

    return {
      sourceUrl: candidate.sourceUrl,
      canonicalUrl: candidate.sourceUrl,
      title: candidate.title,
      excerpt: candidate.excerpt,
    };
  }
}

async function insertSourceItem(item: BtcBreakdownSourceItem): Promise<boolean> {
  const result = await pool.query(
    `
      insert into source_items (
        id,
        provider,
        source_url,
        canonical_url,
        title,
        excerpt,
        language,
        status,
        metadata,
        fetched_at,
        created_at,
        updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, 'new', $8, now(), now(), now())
      on conflict (provider, canonical_url) do nothing
      returning id
    `,
    [
      randomUUID(),
      PROVIDER,
      item.sourceUrl,
      item.canonicalUrl,
      item.title,
      item.excerpt ?? null,
      DEFAULT_LANGUAGE,
      {
        source: "homepage",
        ingestion: "minimal",
      },
    ],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function ingestBtcBreakdownSourceItems(): Promise<number> {
  const baseUrl = workerConfig.btcbreakdownBaseUrl;
  const homepageHtml = await fetchText(baseUrl);
  const candidates = extractCandidates(homepageHtml, baseUrl, workerConfig.sourceIngestionBatchSize);
  let inserted = 0;

  for (const candidate of candidates) {
    const item = await fetchSourceItem(candidate, baseUrl);
    const wasInserted = await insertSourceItem(item);

    if (wasInserted) {
      inserted += 1;
    }
  }

  console.log(JSON.stringify({
    service: "relaypress-worker",
    component: "source-ingestion-btcbreakdown",
    status: "completed",
    provider: PROVIDER,
    candidates: candidates.length,
    inserted,
    timestamp: new Date().toISOString(),
  }));

  return inserted;
}

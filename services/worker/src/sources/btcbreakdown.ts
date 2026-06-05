import { randomUUID } from "node:crypto";
import { pool } from "../db.js";

type SourceCandidate = {
  title: string;
  sourceUrl: string;
  excerpt: string | null;
  publishedAt: Date | null;
  metadata: Record<string, unknown>;
};

type IngestResult = {
  fetched: boolean;
  insertedOrUpdated: number;
  sourceUrl: string | null;
  error?: string;
};

type BtcBreakdownIngestConfig = {
  enabled: boolean;
  baseUrl: string;
  feedUrls: string[];
  maxItems: number;
  intervalMs: number;
};

let lastIngestAttempt = 0;

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ");
}

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");
}

function textFromXml(value: string): string {
  return normalizeWhitespace(decodeEntities(stripTags(value)));
}

function firstMatch(block: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (match?.[1]) return textFromXml(match[1]);
  }

  return null;
}

function firstRawMatch(block: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (match?.[1]) return decodeEntities(match[1].trim());
  }

  return null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function absoluteUrl(value: string, baseUrl: string): string | null {
  try {
    return new URL(value, baseUrl).toString();
  } catch (_error) {
    return null;
  }
}

function excerpt(value: string | null, maxLength = 500): string | null {
  if (!value) return null;
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function parseFeedItems(body: string, feedUrl: string, maxItems: number): SourceCandidate[] {
  const blocks = [...body.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const atomBlocks = blocks.length > 0 ? [] : [...body.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const candidates: SourceCandidate[] = [];

  for (const block of [...blocks, ...atomBlocks]) {
    const title = firstMatch(block, [/<title\b[^>]*>([\s\S]*?)<\/title>/i]);
    const xmlLink = firstMatch(block, [/<link\b[^>]*>([\s\S]*?)<\/link>/i]);
    const atomHref = firstRawMatch(block, [/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i]);
    const rawUrl = xmlLink || atomHref;
    const sourceUrl = rawUrl ? absoluteUrl(rawUrl, feedUrl) : null;

    if (!title || !sourceUrl) continue;

    const description = firstMatch(block, [
      /<description\b[^>]*>([\s\S]*?)<\/description>/i,
      /<summary\b[^>]*>([\s\S]*?)<\/summary>/i,
      /<content:encoded\b[^>]*>([\s\S]*?)<\/content:encoded>/i,
      /<content\b[^>]*>([\s\S]*?)<\/content>/i,
    ]);
    const published = firstMatch(block, [
      /<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i,
      /<published\b[^>]*>([\s\S]*?)<\/published>/i,
      /<updated\b[^>]*>([\s\S]*?)<\/updated>/i,
      /<dc:date\b[^>]*>([\s\S]*?)<\/dc:date>/i,
    ]);

    candidates.push({
      title,
      sourceUrl,
      excerpt: excerpt(description),
      publishedAt: parseDate(published),
      metadata: {
        parser: "feed",
        feedUrl,
      },
    });

    if (candidates.length >= maxItems) break;
  }

  return candidates;
}

function parseHtmlItems(body: string, baseUrl: string, maxItems: number): SourceCandidate[] {
  const candidates: SourceCandidate[] = [];
  const seen = new Set<string>();
  const articleBlocks = [...body.matchAll(/<article\b[\s\S]*?<\/article>/gi)].map((match) => match[0]);
  const blocks = articleBlocks.length > 0 ? articleBlocks : [body];

  for (const block of blocks) {
    const links = [...block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    for (const link of links) {
      const rawHref = decodeEntities(link[1] ?? "");
      const sourceUrl = absoluteUrl(rawHref, baseUrl);
      const title = textFromXml(link[2] ?? "");

      if (!sourceUrl || !title || seen.has(sourceUrl)) continue;
      if (!sourceUrl.startsWith(baseUrl)) continue;
      if (title.length < 8) continue;
      if (sourceUrl.includes("#") || sourceUrl.includes("/tags") || sourceUrl.includes("/about")) continue;

      seen.add(sourceUrl);
      candidates.push({
        title,
        sourceUrl,
        excerpt: null,
        publishedAt: null,
        metadata: {
          parser: "html",
          pageUrl: baseUrl,
        },
      });

      if (candidates.length >= maxItems) return candidates;
    }
  }

  return candidates;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8",
      "user-agent": "RelayPress/0.1 (+https://github.com/Copinmalin/relaypress)",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }

  return response.text();
}

async function upsertSourceItems(items: SourceCandidate[]): Promise<number> {
  let count = 0;

  for (const item of items) {
    await pool.query(
      `
        insert into editorial_source_items (
          id,
          provider,
          source_url,
          title,
          excerpt,
          status,
          published_at,
          fetched_at,
          metadata,
          created_at,
          updated_at
        ) values ($1, 'btcbreakdown', $2, $3, $4, 'new', $5, now(), $6::jsonb, now(), now())
        on conflict (provider, source_url) do update set
          title = excluded.title,
          excerpt = excluded.excerpt,
          published_at = coalesce(excluded.published_at, editorial_source_items.published_at),
          fetched_at = now(),
          metadata = excluded.metadata,
          updated_at = now()
      `,
      [randomUUID(), item.sourceUrl, item.title, item.excerpt, item.publishedAt, JSON.stringify(item.metadata)],
    );
    count += 1;
  }

  return count;
}

export async function ingestBtcBreakdown(config: BtcBreakdownIngestConfig): Promise<IngestResult> {
  if (!config.enabled) {
    return { fetched: false, insertedOrUpdated: 0, sourceUrl: null };
  }

  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const feedUrls = config.feedUrls.length > 0
    ? config.feedUrls
    : [`${baseUrl}/feed`, `${baseUrl}/rss`, `${baseUrl}/atom.xml`, baseUrl];

  let lastError: Error | null = null;

  for (const url of feedUrls) {
    try {
      const body = await fetchText(url);
      const items = parseFeedItems(body, url, config.maxItems);
      const parsedItems = items.length > 0 ? items : parseHtmlItems(body, baseUrl, config.maxItems);

      if (parsedItems.length === 0) {
        lastError = new Error(`No source items parsed from ${url}`);
        continue;
      }

      const insertedOrUpdated = await upsertSourceItems(parsedItems);
      return { fetched: true, insertedOrUpdated, sourceUrl: url };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  return {
    fetched: false,
    insertedOrUpdated: 0,
    sourceUrl: null,
    error: lastError?.message ?? "BTC Breakdown ingest failed",
  };
}

export async function ingestBtcBreakdownIfDue(config: BtcBreakdownIngestConfig): Promise<IngestResult> {
  const now = Date.now();
  if (lastIngestAttempt > 0 && now - lastIngestAttempt < config.intervalMs) {
    return { fetched: false, insertedOrUpdated: 0, sourceUrl: null };
  }

  lastIngestAttempt = now;
  return ingestBtcBreakdown(config);
}

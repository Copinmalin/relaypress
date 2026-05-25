import { randomUUID } from "node:crypto";
import { ensureSourceItemsTable } from "@relaypress/db";
import { pool } from "../db.js";

const PROVIDER = "btcbreakdown";
const HOME_URL = process.env.BTCBREAKDOWN_URL ?? "https://www.btcbreakdown.com";
const FETCH_INTERVAL_MS = Number(process.env.SOURCE_FETCH_INTERVAL_MS ?? 43_200_000);
const MAX_ITEMS = Math.min(Math.max(Number(process.env.BTCBREAKDOWN_MAX_ITEMS ?? 5), 1), 20);

let lastFetchAt = 0;

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#039;", "'")
    .replaceAll("&nbsp;", " ");
}

function stripHtml(value: string): string {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function meta(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"));
  return match?.[1] ? decodeHtml(match[1]).trim() : null;
}

function titleFromHtml(html: string): string {
  const og = meta(html, "og:title");
  if (og) return og;
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match?.[1] ? stripHtml(match[1]) : "BTC Breakdown issue";
}

function contentFromHtml(html: string): string {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  return stripHtml(body);
}

function latestIssueUrls(homeHtml: string): string[] {
  const found = new Set<string>();
  for (const match of homeHtml.matchAll(/href=["']([^"']*\/p\/[^"'#?]+)[^"']*["']/gi)) {
    const raw = match[1] ?? "";
    const url = raw.startsWith("http") ? raw : new URL(raw, HOME_URL).toString();
    if (url.includes("/p/")) found.add(url);
    if (found.size >= MAX_ITEMS) break;
  }
  return [...found];
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { "user-agent": "RelayPress/0.1 source fetcher" } });
  if (!response.ok) throw new Error(`BTC Breakdown fetch failed: ${response.status} ${url}`);
  return response.text();
}

async function upsertIssue(url: string): Promise<"inserted" | "updated"> {
  const html = await fetchText(url);
  const title = titleFromHtml(html);
  const content = contentFromHtml(html);
  const description = meta(html, "description") ?? meta(html, "og:description");
  const imageUrl = meta(html, "og:image");
  const publishedAt = meta(html, "article:published_time");
  const metadata = { description, imageUrl, publishedAt, fetchedAt: new Date().toISOString() };
  const id = `source:${PROVIDER}:${randomUUID()}`;

  const result = await pool.query(
    [
      "insert into source_items (id, provider, source_url, title, content, status, metadata, created_at, updated_at)",
      "values ($1, $2, $3, $4, $5, 'imported', $6::jsonb, now(), now())",
      "on conflict (provider, source_url) do update set",
      "title = excluded.title, content = excluded.content, metadata = excluded.metadata, updated_at = now()",
      "returning (xmax = 0) as inserted",
    ].join("\n"),
    [id, PROVIDER, url, title, content, JSON.stringify(metadata)],
  );

  return result.rows[0]?.inserted ? "inserted" : "updated";
}

export async function fetchBtcBreakdownSources(force = false): Promise<{ checked: number; inserted: number; updated: number; skipped: boolean }> {
  const now = Date.now();
  if (!force && now - lastFetchAt < FETCH_INTERVAL_MS) {
    return { checked: 0, inserted: 0, updated: 0, skipped: true };
  }

  lastFetchAt = now;
  await ensureSourceItemsTable(pool);
  const homeHtml = await fetchText(HOME_URL);
  const urls = latestIssueUrls(homeHtml);
  let inserted = 0;
  let updated = 0;

  for (const url of urls) {
    const result = await upsertIssue(url);
    if (result === "inserted") inserted += 1;
    if (result === "updated") updated += 1;
  }

  return { checked: urls.length, inserted, updated, skipped: false };
}

import type { Event } from "nostr-tools";
import { nostrEvents } from "@relaypress/db";
import { db } from "../db.js";

export async function storeNostrEvent(event: Event): Promise<void> {
  await db
    .insert(nostrEvents)
    .values({
      id: event.id,
      pubkey: event.pubkey,
      kind: event.kind,
      content: event.content,
      tags: event.tags,
      sig: event.sig,
      createdAt: new Date(event.created_at * 1000),
      raw: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing();
}

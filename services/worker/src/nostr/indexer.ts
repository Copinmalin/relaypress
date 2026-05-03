import { SimplePool, type EventTemplate } from "nostr-tools";
import WebSocket from "ws";
import { workerConfig } from "../config";

// nostr-tools expects a WebSocket implementation when running under Node.
// The cast keeps the implementation isolated from the rest of the worker.
(globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;

type RelayPressNostrEvent = EventTemplate & {
  id: string;
  pubkey: string;
  sig: string;
};

function uniqueRelays(): string[] {
  return Array.from(
    new Set([
      workerConfig.nostrPrivateRelay,
      ...workerConfig.nostrPublicRelays,
    ].filter(Boolean)),
  );
}

function buildFilters() {
  const since = Math.floor(Date.now() / 1000) - workerConfig.nostrLookbackSeconds;
  const baseFilter = {
    kinds: [1, 30023, 30024, 30078, 31922, 31923, 30420, 30421, 30422, 30423, 30424],
    since,
    limit: 100,
  };

  if (workerConfig.nostrAllowedPubkeys.length === 0) {
    return [baseFilter];
  }

  return [
    {
      ...baseFilter,
      authors: workerConfig.nostrAllowedPubkeys,
    },
  ];
}

export async function startNostrIndexer(): Promise<void> {
  const pool = new SimplePool();
  const relays = uniqueRelays();
  const filters = buildFilters();

  console.log(JSON.stringify({
    service: "relaypress-worker",
    component: "nostr-indexer",
    status: "starting",
    relays,
    filters,
    timestamp: new Date().toISOString(),
  }));

  const sub = pool.subscribeMany(relays, filters, {
    onevent(event: RelayPressNostrEvent) {
      console.log(JSON.stringify({
        service: "relaypress-worker",
        component: "nostr-indexer",
        status: "event_received",
        eventId: event.id,
        pubkey: event.pubkey,
        kind: event.kind,
        createdAt: event.created_at,
        timestamp: new Date().toISOString(),
      }));
    },
    oneose() {
      console.log(JSON.stringify({
        service: "relaypress-worker",
        component: "nostr-indexer",
        status: "end_of_stored_events",
        timestamp: new Date().toISOString(),
      }));
    },
  });

  process.once("SIGTERM", () => {
    sub.close();
    pool.close(relays);
  });

  process.once("SIGINT", () => {
    sub.close();
    pool.close(relays);
  });
}

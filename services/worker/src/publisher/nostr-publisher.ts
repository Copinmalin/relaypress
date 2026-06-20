import { finalizeEvent, nip19 } from "nostr-tools";
import WebSocket from "ws";
import { workerConfig } from "../config.js";
import type {
  ClaimedPublicationJob,
  PublicationPublishResult,
  PublicationPublisher,
} from "./types.js";
import { PublisherPublishError } from "./types.js";

type NostrPublisherOptions = {
  allowedJobId?: string;
};

type NostrEvent = ReturnType<typeof finalizeEvent>;

type RelayPublishResult = {
  relayUrl: string;
  ok: boolean;
  accepted: boolean;
  message?: string;
  eventId?: string;
};

function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

function readSecretKey(nsec: string): Uint8Array {
  const decoded = nip19.decode(nsec);

  if (decoded.type !== "nsec" || !isUint8Array(decoded.data)) {
    throw new Error("NOSTR_PRIVATE_KEY_NSEC must be a valid nsec private key");
  }

  return decoded.data;
}

function createKind1Event(content: string, secretKey: Uint8Array): NostrEvent {
  return finalizeEvent({
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content,
  }, secretKey);
}

function publishToRelay(relayUrl: string, event: NostrEvent, timeoutMs = 8_000): Promise<RelayPublishResult> {
  return new Promise((resolve) => {
    let settled = false;
    let socket: WebSocket | null = null;

    const finish = (result: RelayPublishResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket?.close();
      } catch {
        // Ignore close errors in cleanup.
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        relayUrl,
        ok: false,
        accepted: false,
        eventId: event.id,
        message: "relay_timeout",
      });
    }, timeoutMs);

    try {
      socket = new WebSocket(relayUrl);
    } catch (error) {
      finish({
        relayUrl,
        ok: false,
        accepted: false,
        eventId: event.id,
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    socket.once("open", () => {
      socket?.send(JSON.stringify(["EVENT", event]));
    });

    socket.on("message", (data) => {
      try {
        const payload = JSON.parse(data.toString()) as unknown;
        if (!Array.isArray(payload) || payload[0] !== "OK" || payload[1] !== event.id) return;

        const accepted = payload[2] === true;
        const message = typeof payload[3] === "string" ? payload[3] : undefined;
        finish({
          relayUrl,
          ok: accepted,
          accepted,
          eventId: event.id,
          message,
        });
      } catch (error) {
        finish({
          relayUrl,
          ok: false,
          accepted: false,
          eventId: event.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });

    socket.once("error", (error) => {
      finish({
        relayUrl,
        ok: false,
        accepted: false,
        eventId: event.id,
        message: error.message,
      });
    });

    socket.once("close", () => {
      finish({
        relayUrl,
        ok: false,
        accepted: false,
        eventId: event.id,
        message: "relay_closed_before_ok",
      });
    });
  });
}

export function createNostrPublisher(options: NostrPublisherOptions): PublicationPublisher {
  return {
    platform: "nostr_longform",
    mode: "real",
    component: "nostr-real-publisher",
    maxJobsPerTick: 1,
    allowedJobId: options.allowedJobId,
    isReady: async () => {
      if (!workerConfig.nostrPrivateKeyNsec) {
        return { ready: false, reason: "nostr_private_key_nsec_missing" };
      }

      if (workerConfig.nostrPublicRelays.length === 0) {
        return { ready: false, reason: "nostr_public_relays_missing" };
      }

      try {
        readSecretKey(workerConfig.nostrPrivateKeyNsec);
      } catch (error) {
        return { ready: false, reason: error instanceof Error ? error.message : String(error) };
      }

      return { ready: true };
    },
    publish: async (job: ClaimedPublicationJob): Promise<PublicationPublishResult> => {
      if (job.platform !== "nostr_longform") {
        throw new Error(`Nostr publisher cannot publish platform: ${job.platform}`);
      }

      const content = job.adapted_content?.trim();
      if (!content) {
        throw new PublisherPublishError("Nostr publication content is empty", {
          ok: false,
          platform: job.platform,
          reason: "empty_content",
        });
      }

      const secretKey = readSecretKey(workerConfig.nostrPrivateKeyNsec);
      const event = createKind1Event(content, secretKey);
      const relayResults = await Promise.all(
        workerConfig.nostrPublicRelays.map((relayUrl) => publishToRelay(relayUrl, event)),
      );
      const acceptedRelays = relayResults.filter((result) => result.accepted).map((result) => result.relayUrl);

      if (acceptedRelays.length === 0) {
        throw new PublisherPublishError("Nostr event was rejected or not acknowledged by all relays", {
          ok: false,
          platform: job.platform,
          eventId: event.id,
          eventPubkey: event.pubkey,
          relayResults,
        });
      }

      return {
        externalPostId: `nostr:${event.id}`,
        rawResponse: {
          ok: true,
          platform: job.platform,
          eventId: event.id,
          eventPubkey: event.pubkey,
          eventKind: event.kind,
          acceptedRelays,
          relayResults,
        },
      };
    },
  };
}

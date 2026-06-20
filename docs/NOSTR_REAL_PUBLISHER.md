# Nostr real publisher

RelayPress can publish a single approved `nostr_longform` job to Nostr relays through a tightly controlled real publisher.

## Safety model

Real publication is disabled by default. A real Nostr run requires all of the following:

```env
NOSTR_PUBLISHER_MODE=real
NOSTR_REAL_SAFETY_ACK=I_UNDERSTAND_NOSTR_REAL_PUBLICATION
NOSTR_PRIVATE_KEY_NSEC=<server-only nsec>
NOSTR_REAL_ALLOWED_JOB_ID=<exact publication job id>
```

The worker also keeps `maxJobsPerTick=1` for the Nostr real publisher.

Never commit a real `nsec`. Put it only in the deployment `.env` or a secret manager.

## Publisher identity

Use a dedicated publication identity, for example the B-Conseil Nostr identity:

```text
npub148v32deegjkmnh4ype0h2r82jrdnwsnkvsfafg29dl2upndv53cscnvu7j
```

The corresponding `nsec` must stay private and is read from:

```env
NOSTR_PRIVATE_KEY_NSEC=
```

## Relays

Configure relays as a comma-separated list:

```env
NOSTR_PUBLIC_RELAYS=wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net
```

RelayPress considers the publication successful when at least one relay acknowledges the event with `OK`.

## Event format

PR Y1 starts with a simple Nostr text note:

```text
kind 1
```

Long-form Nostr events can be added later once the real publishing path is verified.

## One-shot test flow

1. Keep the normal worker in mock mode.
2. Create and approve one `nostr_longform` job.
3. Stop the worker.
4. Run a one-shot worker container with the exact allowed job ID.
5. Immediately return `NOSTR_PUBLISHER_MODE=mock` and restart the worker.

Example skeleton:

```bash
docker compose stop worker

docker compose run --rm -T --no-deps \
  -e SOURCE_INGESTION_ENABLED=false \
  -e NOSTR_PUBLISHER_MODE=real \
  -e NOSTR_REAL_SAFETY_ACK=I_UNDERSTAND_NOSTR_REAL_PUBLICATION \
  -e NOSTR_PRIVATE_KEY_NSEC="$NOSTR_PRIVATE_KEY_NSEC" \
  -e NOSTR_REAL_ALLOWED_JOB_ID="$JOB_ID" \
  -e LINKEDIN_PUBLISHER_MODE=disabled \
  -e X_PUBLISHER_MODE=disabled \
  -e FACEBOOK_PUBLISHER_MODE=disabled \
  -e INSTAGRAM_PUBLISHER_MODE=disabled \
  worker node --input-type=module <<'NODE'
import { describePublisherRouting, processApprovedPublicationJobs } from "./services/worker/dist/publisher/index.js";
console.log(JSON.stringify(describePublisherRouting(), null, 2));
console.log(`PUBLISHED_JOBS=${await processApprovedPublicationJobs()}`);
NODE

docker compose up -d worker
```

## Audit

Successful runs include:

- `externalPostId`: `nostr:<event-id>`
- `publisherResponse.eventId`
- `publisherResponse.eventPubkey`
- `publisherResponse.eventKind`
- `publisherResponse.acceptedRelays`
- `publisherResponse.relayResults`

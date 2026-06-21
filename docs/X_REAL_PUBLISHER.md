# X real publisher

RelayPress can connect an X account through OAuth 2.0 and prepare a tightly controlled real publisher for one approved `x` job.

The default posture is conservative: X stays in `mock` mode unless an operator opens a short, explicit real-publication window for one exact job id.

## X Developer Console

Configure the X app with:

```text
OAuth 2.0 enabled
App type: Web App
Permissions: Read and write
Callback URL: https://api.relaypress.copinmalin.top/publisher-accounts/x/oauth/callback
```

RelayPress only requests the scopes configured in `X_OAUTH_SCOPES`.

Recommended scopes:

```env
X_OAUTH_SCOPES=tweet.read tweet.write users.read offline.access
```

Do not request DM scopes for RelayPress.

## OAuth environment

```env
X_CLIENT_ID=
X_CLIENT_SECRET=
X_OAUTH_REDIRECT_URI=https://api.relaypress.copinmalin.top/publisher-accounts/x/oauth/callback
X_OAUTH_SCOPES=tweet.read tweet.write users.read offline.access
X_API_BASE_URL=https://api.x.com/2
X_OAUTH_TOKEN_URL=https://api.x.com/2/oauth2/token
```

Never commit `X_CLIENT_SECRET`.

If an admin token, OAuth client secret or transcript containing either value is exposed, rotate the affected secret before merging or running any real publisher test.

## Connect an account

1. Open `/admin/publishers`.
2. Enter a valid `ADMIN_API_TOKEN` in the admin token field.
3. Click `Connecter X`.
4. Complete the X OAuth consent flow.
5. Return to `/admin/publishers` and verify that the account status is `connected`.

The API also exposes the same start flow through:

```text
POST /publisher-accounts/x/oauth/start
```

The callback stores the account as a `publisher_accounts` row with:

```text
provider=x
accountUrn=urn:x:user:<x-user-id>
status=connected
scopes=offline.access,tweet.read,tweet.write,users.read
```

## Connection check

Use the publisher account id returned by the admin page or database:

```bash
curl -sS -X POST \
  "https://api.relaypress.copinmalin.top/publisher-accounts/<publisher-account-id>/check-connection" \
  -H "Authorization: Bearer $ADMIN_API_TOKEN"
```

A healthy X connection returns `ok: true`, the expected `urn:x:user:<id>` and the granted scopes.

## Safety model

Real X publication must remain disabled by default.

```env
X_PUBLISHER_MODE=mock
X_REAL_SAFETY_ACK=
X_PUBLISHER_ACCOUNT_ID=
X_REAL_ALLOWED_JOB_ID=
```

A real one-shot publication requires all four values:

```env
X_PUBLISHER_MODE=real
X_REAL_SAFETY_ACK=I_UNDERSTAND_X_REAL_PUBLICATION
X_PUBLISHER_ACCOUNT_ID=<stored publisher account id>
X_REAL_ALLOWED_JOB_ID=<exact publication job id>
```

The X real publisher is constrained to one job per tick.

Without the safety acknowledgement, the route must stay disabled with:

```text
x_real_safety_ack_missing_or_invalid
```

Without an exact `X_REAL_ALLOWED_JOB_ID`, no approved X job should be claimed by the real publisher.

## API behavior

The real publisher creates a post with:

```text
POST /2/tweets
```

The raw provider response is stored in the publication run audit, alongside `externalPostId` in the form:

```text
x:<tweet-id>
```

## One-shot flow

1. Keep the normal worker in mock mode.
2. Connect X via `/admin/publishers` or `POST /publisher-accounts/x/oauth/start`.
3. Create and approve one `x` job.
4. Stop the normal worker.
5. Run a one-shot worker with the exact allowed job id.
6. Confirm one and only one real X publication run.
7. Return to mock mode and restart the worker.

Example environment for the one-shot worker:

```env
SOURCE_INGESTION_ENABLED=false
PUBLISHER_BATCH_SIZE=1
LINKEDIN_PUBLISHER_MODE=disabled
X_PUBLISHER_MODE=real
X_REAL_SAFETY_ACK=I_UNDERSTAND_X_REAL_PUBLICATION
X_PUBLISHER_ACCOUNT_ID=<stored publisher account id>
X_REAL_ALLOWED_JOB_ID=<exact publication job id>
FACEBOOK_PUBLISHER_MODE=disabled
INSTAGRAM_PUBLISHER_MODE=disabled
NOSTR_PUBLISHER_MODE=disabled
```

Do not leave `X_PUBLISHER_MODE=real` enabled after the one-shot run.

## Smoke validation

Run the guarded routing smoke on staging with:

```bash
bash scripts/smoke-pr-x0-publisher-routing.sh
```

Expected success markers:

```text
PUBLISHED_JOBS=4
REAL_MODE_BLOCKED_OK
PR_X0_PUBLISHER_ROUTING_SMOKE=OK
```

The smoke validates that:

- LinkedIn, X, Facebook and Nostr long-form can be routed in mock mode.
- Instagram remains unclaimed when disabled.
- X real mode is blocked without `X_REAL_SAFETY_ACK`.
- The blocked X job remains `approved`, with no `externalPostId` and no `publishedAt`.
- No real X publication occurs during the smoke.

For a full root check without host-level Node/npm/pnpm, use a disposable Node container:

```bash
docker run --rm \
  -v "$PWD":/app \
  -w /app \
  -e COREPACK_HOME=/tmp/corepack \
  -e PNPM_HOME=/tmp/pnpm \
  node:24-alpine \
  sh -lc 'corepack enable && pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm build && pnpm check'
```

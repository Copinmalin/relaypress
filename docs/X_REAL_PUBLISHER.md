# X real publisher

RelayPress can connect an X account through OAuth 2.0 and prepare a tightly controlled real publisher for one approved `x` job.

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

## Safety model

Real X publication must remain disabled by default.

```env
X_PUBLISHER_MODE=mock
X_REAL_SAFETY_ACK=
X_PUBLISHER_ACCOUNT_ID=
X_REAL_ALLOWED_JOB_ID=
```

A real one-shot publication requires:

```env
X_PUBLISHER_MODE=real
X_REAL_SAFETY_ACK=I_UNDERSTAND_X_REAL_PUBLICATION
X_PUBLISHER_ACCOUNT_ID=<stored publisher account id>
X_REAL_ALLOWED_JOB_ID=<exact publication job id>
```

The X real publisher is constrained to one job per tick.

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

1. Keep normal worker in mock mode.
2. Connect X via `/admin/publishers` or `POST /publisher-accounts/x/oauth/start`.
3. Create and approve one `x` job.
4. Stop the worker.
5. Run a one-shot worker with the exact allowed job id.
6. Return to mock mode and restart the worker.

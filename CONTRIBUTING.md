# Contributing to RelayPress

Thank you for considering a contribution to RelayPress.

RelayPress is a sovereign editorial orchestration project. Contributions should strengthen control, auditability, security and source-grounded publication workflows.

## Before contributing

For small fixes, open a pull request directly.

For larger work, open or comment on an issue first, especially when the change affects:

- database schema or migrations;
- authentication or authorization;
- publisher integrations;
- OAuth flows or token storage;
- Nostr behavior;
- AI generation behavior;
- billing or payment logic;
- deployment and infrastructure;
- license, trademark or governance documents.

## Contribution rules

A contribution should:

- preserve AGPL-3.0-or-later licensing;
- avoid adding secrets, tokens, private keys or credentials to the repository;
- keep real publishers disabled or explicitly guarded by default;
- preserve human validation before real publication;
- keep publication attempts auditable;
- avoid silent background publication;
- include documentation when behavior changes;
- keep changes focused and reviewable.

## Development baseline

RelayPress uses:

- Node 24 or later;
- pnpm 9.15 or later;
- TypeScript;
- PostgreSQL;
- Docker Compose for local or staging environments.

Useful commands:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
pnpm check
```

## Pull request expectations

A pull request should include:

- a clear summary;
- the reason for the change;
- the files or modules affected;
- manual test notes;
- migration notes when relevant;
- security notes when relevant;
- screenshots or admin UI notes when relevant.

Avoid oversized pull requests. Prefer a chain of small, coherent increments.

## Documentation

Changes that affect doctrine, architecture, publisher behavior, security posture, deployment or roadmap should update the relevant documentation.

Permanent documentation should be kept concise and consolidated. Do not create a new long-lived document for every pull request unless the document is a stable reference, policy, runbook or product doctrine.

## Publisher integrations

Real publisher integrations are high-risk areas.

A new or modified real publisher must define:

- supported platform;
- supported account type;
- required scopes;
- token storage and refresh behavior;
- safety switches;
- failure handling;
- audit payloads;
- rollback or disable procedure;
- test plan using mock mode first.

No real publisher should publish without explicit approval and clear operator intent.

## Security and secrets

Never commit:

- API keys;
- OAuth tokens;
- Nostr private keys;
- database credentials;
- production environment files;
- private logs;
- customer data;
- screenshots exposing secrets.

If a secret is accidentally committed, assume it is compromised and rotate it immediately.

## Licensing of contributions

By contributing to RelayPress, you agree that your contribution is provided under AGPL-3.0-or-later, unless the maintainers explicitly accept another arrangement in writing.

You must only contribute code, documentation or assets that you have the right to submit.

## Conduct

Be direct, precise and respectful. Technical disagreement is welcome. Confusion, vague claims and hidden breaking changes are not.

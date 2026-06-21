# Security Policy

RelayPress handles editorial workflows, publication accounts, OAuth credentials, Nostr data, third-party APIs and future payment flows. Security reports are welcome.

## Supported versions

RelayPress is currently pre-1.0 software.

Security fixes should target the main development line unless maintainers publish a supported release policy later.

## Issues to report privately

Please report privately any issue that may affect:

- authentication or authorization;
- token or credential handling;
- OAuth flows;
- Nostr keys or signing material;
- publication without explicit approval;
- publisher account confusion;
- workspace or profile isolation;
- payment or billing authorization;
- database access;
- private logs;
- backup and restore safety;
- dependency vulnerabilities with practical impact.

## Do not publish sensitive details in public issues

Do not open a public issue containing:

- private keys;
- API tokens;
- OAuth tokens;
- database credentials;
- customer data;
- private URLs;
- screenshots exposing secrets;
- detailed reproduction material for an unresolved vulnerability.

If a public issue is necessary, keep it high level and wait for maintainer guidance.

## Reporting process

Preferred process:

1. Use GitHub private vulnerability reporting if it is enabled for the repository.
2. If private reporting is not available, contact the maintainers through a private channel before publishing details.
3. Provide a clear description, affected version or commit, impact, expected behavior and suggested mitigation if known.

## Maintainer response

Maintainers should aim to:

- acknowledge the report;
- assess severity;
- reproduce the issue safely;
- prepare a fix or mitigation;
- avoid exposing secrets in discussion or logs;
- publish a security note when appropriate.

## Security defaults

RelayPress should remain conservative by default:

- mock publishers should be the safe default;
- real publishers should require explicit activation;
- human approval should remain mandatory before real publication;
- secrets must not be committed;
- logs must not expose tokens, private keys or sensitive payloads;
- publication attempts must remain auditable;
- payment flows must require explicit pricing, authorization and receipts.

## Secret exposure

If a secret is exposed:

1. Treat it as compromised.
2. Rotate it immediately.
3. Revoke affected tokens where possible.
4. Check logs, runs and publication history.
5. Remove the secret from history only as a cleanup step, not as a substitute for rotation.

## Responsible disclosure

Please give maintainers a reasonable opportunity to fix confirmed vulnerabilities before public disclosure.

RelayPress is open-source, but responsible disclosure helps protect operators, contributors and users.

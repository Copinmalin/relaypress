# RelayPress Governance

RelayPress is governed as an open-source upstream project with a strong preference for transparency, security, human editorial control and long-term maintainability.

## Reference upstream

The reference upstream repository is:

https://github.com/Copinmalin/relaypress

This repository is the canonical place for project direction, issue tracking, releases, documentation and contribution review unless the maintainers explicitly designate another upstream.

## Core principles

RelayPress is guided by the following principles:

1. Sovereign editorial orchestration over blind automation.
2. Human validation before real publication.
3. Auditable publication runs.
4. Secure handling of secrets and third-party credentials.
5. Open-source continuity under AGPL-3.0-or-later.
6. Clear distinction between official upstream and forks.
7. Incremental changes over uncontrolled rewrites.
8. Real publishers only through explicit, reviewed and documented activation.

## Maintainers

Maintainers are responsible for:

- reviewing issues and pull requests;
- protecting the project doctrine;
- maintaining the roadmap;
- deciding whether a change belongs in the upstream project;
- preserving security boundaries;
- enforcing license, notice and trademark expectations;
- preparing releases and migration notes.

Maintainers may reject changes that are technically valid but conflict with the product doctrine, security model or long-term project direction.

## Decision process

Most decisions happen through GitHub issues and pull requests.

Small changes may be accepted directly through pull request review.

Architectural, licensing, security, data model, publisher, authentication, billing or deployment changes should normally be discussed in an issue before implementation.

When a decision affects the project doctrine or operating model, the final decision should be reflected in the appropriate documentation file.

## Project doctrine

RelayPress is not a simple crossposter. The intended chain is:

```text
source
-> human selection
-> editorial signal
-> campaign
-> AI-assisted generation
-> human review
-> explicit approval
-> controlled publisher
-> audit
```

A contribution that removes human control, bypasses review, weakens auditability or silently arms real publication should be considered high risk.

## Roadmap discipline

The roadmap should remain coherent with the project tracking documentation.

Large features should be split into staged increments:

- documentation and doctrine;
- data model;
- API and admin interface;
- worker behavior;
- publisher integration;
- tests and runbooks;
- production hardening.

## Compatibility with forks

Forks are legitimate under the AGPL. The upstream project encourages useful improvements to be contributed back when possible.

Forks that diverge materially should clearly identify themselves as modified versions and should not imply official status.

See FORK_POLICY.md and TRADEMARK.md.

## Security-sensitive areas

The following areas require extra caution:

- authentication and authorization;
- publisher accounts and OAuth;
- token encryption and refresh;
- real publication flows;
- payment and billing flows;
- database migrations;
- logs and error reporting;
- Nostr signing keys and relay configuration;
- backup and restore procedures.

Changes in these areas should include clear testing notes and rollback considerations.

## Licensing

RelayPress is licensed under AGPL-3.0-or-later.

Contributions to RelayPress are expected to be made under the same license unless explicitly agreed otherwise by the maintainers.

By submitting a contribution, you represent that you have the right to contribute it and that it can be included in RelayPress under AGPL-3.0-or-later.

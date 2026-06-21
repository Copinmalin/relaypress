# RelayPress Fork Policy

RelayPress is open-source. Forks are allowed and expected under AGPL-3.0-or-later.

This policy explains how to fork RelayPress cleanly without creating confusion about the official upstream project.

## Core rule

Fork freely. Be clear.

Users, contributors and customers must be able to understand whether they are using:

- the official RelayPress upstream;
- an unmodified deployment of RelayPress;
- a modified fork;
- a separate product based on RelayPress;
- a hosted service powered by RelayPress.

## License obligations

RelayPress is licensed under AGPL-3.0-or-later.

If you modify RelayPress and distribute it, you must comply with the AGPL.

If you modify RelayPress and make it available as a network service, you must comply with the AGPL network interaction requirements and provide users access to the corresponding source code of the modified version.

This policy does not replace the license. The LICENSE file controls the legal terms for the code.

## Required fork disclosure

A public fork or derivative service should disclose:

- that it is based on RelayPress;
- the upstream repository URL;
- the base commit, tag or release when practical;
- a summary of material modifications;
- the source code location of the modified version;
- whether it is official or independent.

Suggested wording:

This project is an independent fork of RelayPress, originally created by Copinmalin. It is not the official RelayPress upstream.

## Naming

Forks should use their own project name.

Acceptable examples:

- SignalForge, based on RelayPress
- AlpinePress, a RelayPress fork
- Editorial cockpit powered by RelayPress

Names that imply official status require permission:

- RelayPress Cloud
- RelayPress Pro
- Official RelayPress Hosting
- RelayPress Enterprise

See TRADEMARK.md.

## Source availability for hosted forks

If a modified version is offered as a hosted service, the service should provide a visible link to the corresponding source code.

Suggested location:

- About page;
- Legal page;
- Admin footer;
- System information page;
- public documentation page.

Suggested wording:

This hosted service is based on a modified version of RelayPress. The corresponding source code is available at: <source-url>.

## Upstream contribution preference

Forks do not have to contribute every change upstream, but contributions are encouraged when they improve the shared project.

Good candidates for upstream contribution:

- security fixes;
- bug fixes;
- publisher hardening;
- documentation improvements;
- deployment improvements;
- tests;
- generic features useful beyond one deployment.

Poor candidates for upstream contribution:

- client-specific branding;
- private business logic;
- secrets or private configuration;
- features that weaken human validation;
- shortcuts that bypass audit or publication safety.

## Compatibility claims

A fork may claim compatibility with RelayPress only when the claim is accurate.

If APIs, data models or workflows diverge materially, the fork should document the divergence.

## No impersonation

A fork must not:

- claim to be the official RelayPress project;
- imply endorsement without permission;
- hide material modifications from users;
- use RelayPress branding in a way that creates confusion;
- remove required license notices or attribution notices.

## Maintainer position

The maintainers welcome forks that respect software freedom and transparency.

The maintainers may publicly clarify that a fork or hosted service is independent if confusion arises.

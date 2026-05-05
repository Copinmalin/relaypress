# Roadmap RelayPress

Cette roadmap doit rester cohérente avec `docs/MASTER_PROJECT_TRACKING.md`, qui est la source de vérité opérationnelle.

## Phase 0 — Cadrage conceptuel

Statut : ✅ terminé

Résultats :

- vision RelayPress clarifiée ;
- refus du simple crossposter ;
- Nostr défini comme plan de contrôle ;
- IA future définie comme adaptation sous contraintes.

## Phase 1 — Socle dépôt et CI

Statut : ✅ terminé

Résultats :

- dépôt GitHub créé ;
- licence AGPL-3.0-or-later ;
- monorepo pnpm ;
- Node 24 ;
- TypeScript NodeNext ;
- `pnpm-lock.yaml` présent et obligatoire ;
- CI GitHub Actions ;
- installation `--frozen-lockfile` ;
- validation Docker Compose.

## Phase 2 — Infrastructure Docker / staging

Statut : ✅ terminé et validé en staging

Résultats :

- Caddy ;
- PostgreSQL ;
- Redis ;
- strfry ;
- API Fastify ;
- worker RelayPress ;
- volumes persistants ;
- HTTPS staging validé.

## Phase 3 — Indexation Nostr

Statut : ✅ terminé et validé runtime

Résultats :

- connexion au relay privé et aux relays publics configurés ;
- filtrage par pubkey autorisée ;
- stockage des événements dans `nostr_events` ;
- logs worker structurés ;
- création de jobs depuis commandes `/publish` ou tags dédiés.

## Phase 4 — Jobs de publication

Statut : ✅ terminé pour MVP

Résultats :

- `publication_jobs` créés depuis Nostr ;
- `publication_jobs` créés depuis brouillons manuels ;
- `source_content` conservé séparément ;
- `adapted_content` par plateforme ;
- un job séparé par plateforme ;
- statuts métier sécurisés ;
- archivage non destructif.

## Phase 5 — Interface admin v2

Statut : ✅ terminé pour MVP

Résultats :

- page admin servie par l’API ;
- assets CSS/JS séparés ;
- lecture protégée par `ADMIN_API_TOKEN` ;
- vues À traiter, actifs, archives ;
- filtres statut, plateforme, ordre ;
- création de brouillon manuel multi-plateforme ;
- comparaison source/adapted ;
- édition humaine avant validation ;
- approbation, rejet, retry, reset-review ;
- readapt depuis `source_content` ;
- runs visibles ;
- archivage individuel et groupé.

## Phase 6 — Audit d’exécution

Statut : ✅ terminé pour MVP

Résultats :

- table `publication_job_runs` ;
- un run créé à chaque tentative de publication ;
- `raw_response` conservée ;
- statut run `started`, `published` ou `failed` ;
- consultation depuis l’admin.

## Phase A — Prévisualisation éditoriale par plateforme

Statut : ✅ terminé MVP

Résultats :

- compteur de caractères ;
- warning contenu vide ;
- warning X trop long ;
- warning routage encore visible ;
- warning Instagram média non géré ;
- preview simple dans l’admin.

## Phase B — Anti-doublon / retry / reset

Statut : ✅ terminé MVP

Résultats :

- publication interdite si `external_post_id` existe ;
- publication interdite si `published_at` existe ;
- approve bloqué sur job publié ;
- retry limité aux jobs failed ;
- reset-review limité aux jobs rejected / failed ;
- worker protégé par claim atomique ;
- transitions invalides en `409`.

## Phase C — Adaptateur LinkedIn propre sans IA

Statut : ✅ terminé MVP

Résultats :

- `sourceContent` conservé ;
- `adaptedContent` LinkedIn structuré ;
- accroche ;
- paragraphes courts ;
- appel à discussion ;
- hashtags ;
- correction de la duplication sur texte court ;
- readapt depuis `sourceContent`.

## Phase D — Couche publisher propre

Statut : ✅ terminé architecture

Résultats :

- interface `PublicationPublisher` ;
- `createMockPublisher()` ;
- `createLinkedInPublisher()` stub ;
- orchestrateur publisher ;
- `supportedPlatforms` par publisher ;
- `isReady()` avant claim ;
- `PUBLISHER_MODE=mock` par défaut ;
- `PUBLISHER_MODE=linkedin_real` préparé mais non actif ;
- `LINKEDIN_ACCESS_TOKEN` et `LINKEDIN_AUTHOR_URN` préparés.

## Phase E — Publisher réel LinkedIn

Statut : ⏳ prochaine phase recommandée

À faire :

1. Choisir le mode d’auth LinkedIn adapté : membre ou page organisation.
2. Finaliser l’app LinkedIn Developer.
3. Définir le `LINKEDIN_AUTHOR_URN` exact.
4. Implémenter l’appel API LinkedIn réel dans `linkedin-publisher.ts`.
5. Gérer les erreurs API dans `publication_job_runs.raw_response`.
6. Garder `PUBLISHER_MODE=mock` par défaut.
7. Tester en staging sur un compte ou une page contrôlée.
8. Ne passer en réel qu’avec validation humaine explicite.

## Phase F — Comptes publishers et chiffrement tokens

Statut : ⏳ à faire avant production

À prévoir :

- table `publisher_accounts` ;
- provider ;
- account URN ;
- display name ;
- access token chiffré ;
- refresh token chiffré si applicable ;
- expiration ;
- scopes ;
- chiffrement via `TOKEN_ENCRYPTION_KEY`.

## Phase G — Publishers X / Meta / Instagram / autres sorties

Statut : ⏳ plus tard

Ordre recommandé :

1. LinkedIn ;
2. X ;
3. Facebook Page ;
4. Instagram Business ;
5. Mastodon / WordPress.

## Phase H — Production durcie

Statut : ⏳ plus tard

À prévoir :

- sauvegarde PostgreSQL automatisée ;
- sauvegarde volumes strfry ;
- monitoring conteneurs ;
- monitoring disque ;
- alertes ;
- rotation logs ;
- rate limiting ;
- authentification web propre ;
- documentation d’exploitation ;
- procédure de restauration.

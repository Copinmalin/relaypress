# Roadmap RelayPress

Cette roadmap doit rester cohérente avec `docs/MASTER_PROJECT_TRACKING.md`, qui est la source de vérité opérationnelle.

## Phases terminées

### Phase 0 — Cadrage conceptuel

Statut : ✅ terminé

- vision RelayPress clarifiée ;
- refus du simple crossposter ;
- Nostr défini comme plan de contrôle ;
- IA future définie comme adaptation sous contraintes.

### Phase 1 — Socle dépôt et CI

Statut : ✅ terminé

- dépôt GitHub créé ;
- licence AGPL-3.0-or-later ;
- monorepo pnpm ;
- Node 24 ;
- TypeScript NodeNext ;
- `pnpm-lock.yaml` présent et obligatoire ;
- CI GitHub Actions ;
- installation `--frozen-lockfile` ;
- validation Docker Compose.

### Phase 2 — Infrastructure Docker / staging

Statut : ✅ terminé et validé en staging

- Caddy ;
- PostgreSQL ;
- Redis ;
- strfry ;
- API Fastify ;
- worker RelayPress ;
- volumes persistants ;
- HTTPS staging validé.

### Phase 3 — Indexation Nostr

Statut : ✅ terminé et validé runtime

- connexion au relay privé et aux relays publics configurés ;
- filtrage par pubkey autorisée ;
- stockage des événements dans `nostr_events` ;
- logs worker structurés ;
- création de jobs depuis commandes `/publish` ou tags dédiés.

### Phase 4 — Jobs de publication

Statut : ✅ terminé pour MVP

- `publication_jobs` créés depuis Nostr ;
- `publication_jobs` créés depuis brouillons manuels ;
- `source_content` conservé séparément ;
- `adapted_content` par plateforme ;
- un job séparé par plateforme ;
- statuts métier sécurisés ;
- archivage non destructif.

### Phase 5 — Interface admin v2

Statut : ✅ terminé pour MVP

- page admin servie par l’API ;
- assets CSS/JS séparés ;
- lecture protégée ;
- vues À traiter, actifs, archives ;
- filtres statut, plateforme, ordre ;
- création de brouillon manuel multi-plateforme ;
- comparaison source/adapted ;
- édition humaine avant validation ;
- approbation, rejet, retry, reset-review ;
- readapt depuis `source_content` ;
- runs visibles ;
- archivage individuel et groupé.

### Phase 6 — Audit d’exécution

Statut : ✅ terminé pour MVP

- table `publication_job_runs` ;
- un run créé à chaque tentative de publication ;
- `raw_response` conservée ;
- statut run `started`, `published` ou `failed` ;
- consultation depuis l’admin.

### Phase A — Prévisualisation éditoriale par plateforme

Statut : ✅ terminé MVP

- compteur de caractères ;
- warning contenu vide ;
- warning X trop long ;
- warning routage encore visible ;
- warning Instagram média non géré ;
- preview simple dans l’admin.

### Phase B — Anti-doublon / retry / reset

Statut : ✅ terminé MVP

- publication interdite si `external_post_id` existe ;
- publication interdite si `published_at` existe ;
- approve bloqué sur job publié ;
- retry limité aux jobs failed ;
- reset-review limité aux jobs rejected / failed ;
- worker protégé par claim atomique ;
- transitions invalides en `409`.

### Phase C — Adaptateur LinkedIn propre sans IA

Statut : ✅ terminé MVP

- `sourceContent` conservé ;
- `adaptedContent` LinkedIn structuré ;
- accroche ;
- paragraphes courts ;
- appel à discussion ;
- hashtags ;
- correction de la duplication sur texte court ;
- readapt depuis `sourceContent`.

### Phase D — Couche publisher propre

Statut : ✅ terminé architecture

- interface `PublicationPublisher` ;
- publisher mock ;
- orchestrateur publisher ;
- plateformes supportées par publisher ;
- vérification de disponibilité avant claim ;
- mode mock conservé par défaut ;
- mode LinkedIn réel préparé derrière garde-fous.

## Phase E — Publisher réel LinkedIn

Statut : 🚧 en cours — premier incrément implémenté, non activé en staging

Réalisé :

- configuration d’endpoint LinkedIn ;
- implémentation du publisher LinkedIn UGC Posts ;
- activation uniquement via mode publisher explicite ;
- mode mock conservé par défaut ;
- vérification de configuration avant claim ;
- refus de publier un contenu LinkedIn vide ;
- extraction de l’identifiant externe depuis la réponse LinkedIn ;
- erreurs LinkedIn nettoyées via erreur typée ;
- conservation des erreurs API nettoyées dans `publication_job_runs.raw_response`.

À faire avant test réel :

1. Finaliser le mode d’authentification LinkedIn : membre ou page organisation.
2. Finaliser l’application LinkedIn Developer.
3. Définir l’URN auteur exact.
4. Configurer un accès contrôlé sur staging.
5. Tester sur un compte ou une page contrôlée.
6. Vérifier le retour API, l’identifiant externe et les runs.
7. Ne garder le réel activé que pour des fenêtres de test explicites.

## Phase F — Comptes publishers et chiffrement

Statut : ⏳ à faire avant production

- table `publisher_accounts` ;
- provider ;
- account URN ;
- display name ;
- secret d’accès chiffré ;
- secret de renouvellement chiffré si applicable ;
- expiration ;
- scopes ;
- chiffrement via clé dédiée.

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

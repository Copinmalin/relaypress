# RelayPress — Document maître de suivi projet

Ce document est la **source de vérité opérationnelle** du projet RelayPress.

Il doit être mis à jour à chaque étape structurante : changement d’architecture, nouveau workflow validé, nouveau statut métier, changement de sécurité, déploiement, ou décision produit importante.

**Dernière mise à jour : 2026-05-05**  
**État global : MVP technique éditorial fonctionnel en staging**

---

## 1. Vision du projet

RelayPress est un système d’orchestration éditoriale souverain, piloté par Nostr, destiné à préparer, valider, adapter, publier et auditer des contenus vers plusieurs plateformes.

L’objectif n’est pas de créer un simple crossposter. L’objectif est de construire une infrastructure où Nostr sert de racine souveraine et où PostgreSQL porte l’état métier opérationnel.

### Formule de conception

```txt
Nostr = intention signée + journal souverain + plan de contrôle
Relay privé = registre canonique des événements éditoriaux
PostgreSQL = état métier opérationnel
Worker = moteur d’indexation, de transformation et de publication
API admin = pilotage éditorial humain
Publishers = sorties vers plateformes externes
IA = adaptation sous contraintes, plus tard
```

### Positionnement actuel

RelayPress est aujourd’hui un **prototype fonctionnel déployé** permettant :

```txt
Nostr event ou brouillon manuel
→ création de jobs éditoriaux
→ édition humaine
→ validation
→ publication mock
→ audit des exécutions
→ archivage non destructif
```

Le système ne publie pas encore réellement vers LinkedIn, X, Facebook ou Instagram. La publication réelle doit venir seulement après stabilisation éditoriale et anti-doublon.

---

## 2. Principes non négociables

- Nostr reste la racine souveraine des intentions éditoriales.
- PostgreSQL est la source d’état métier opérationnel.
- Aucun `nsec` ne doit être stocké en clair.
- Les tokens OAuth devront être chiffrés avant tout branchement réel.
- Pas de scraping de réseaux sociaux.
- Publication externe uniquement via API officielles.
- Les contenus sensibles doivent rester soumis à validation humaine.
- Les actions importantes doivent être auditables.
- Les runs de publication doivent rester conservés.
- L’archivage ne doit pas supprimer l’historique.
- Le lockfile `pnpm-lock.yaml` est obligatoire.
- Node 24 est la cible runtime et CI.
- Docker Compose est la base de reproductibilité staging.

---

## 3. État actuel du dépôt

Dépôt : `Copinmalin/relaypress`  
Branche principale : `main`  
Statut : **buildable, déployé, testé en staging**

### Socle validé

```txt
✅ Monorepo pnpm
✅ pnpm-lock.yaml présent
✅ Node 24
✅ TypeScript NodeNext
✅ GitHub Actions CI
✅ Installation --frozen-lockfile
✅ Docker Compose
✅ Dockerfiles API et Worker
✅ Caddy reverse proxy
✅ PostgreSQL
✅ Redis
✅ strfry comme relay Nostr privé
✅ strfry.conf dédié
✅ API Fastify
✅ Worker RelayPress
✅ Indexer Nostr
✅ Filtrage par pubkey autorisée
✅ Persistance Nostr dans PostgreSQL
✅ Création de publication_jobs
✅ Adaptateur minimal de contenu
✅ Publisher mock
✅ Historique publication_job_runs
✅ Interface admin minimale
✅ Brouillons manuels depuis l’admin
✅ Édition avant validation
✅ Validation / rejet
✅ Archivage individuel
✅ Archivage groupé des jobs terminés
✅ Lecture API protégée par ADMIN_API_TOKEN
```

### Structure projet actuelle

```txt
.
├── .github/workflows/
│   ├── ci.yml
│   └── generate-lockfile.yml
├── docs/
│   ├── 00_PROJECT_VISION.md
│   ├── 01_ARCHITECTURE.md
│   ├── 02_NOSTR_EVENT_MODEL.md
│   ├── 03_SECURITY_MODEL.md
│   ├── 04_DEPLOYMENT_CADDY_DOCKER.md
│   ├── 05_ROADMAP.md
│   ├── 06_CI_NOTES.md
│   └── MASTER_PROJECT_TRACKING.md
├── infra/
│   ├── caddy/Caddyfile
│   └── relay/strfry.conf
├── packages/
│   ├── db/
│   └── shared/
├── services/
│   ├── api/
│   └── worker/
├── scripts/
│   └── validate-local.sh
├── docker-compose.yml
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## 4. Infrastructure staging validée

### Serveur

```txt
Provider : IONOS
Nom d’usage : relaypress-staging
IP : 217.160.186.43
OS : Ubuntu 26.04
CPU : 4 vCore
RAM : 4 Go
Disque : 120 Go NVMe SSD
```

### Sécurité système initiale

```txt
✅ UFW actif
✅ incoming deny par défaut
✅ outgoing allow par défaut
✅ ports ouverts : 22, 80, 443
✅ Docker installé
✅ Docker Compose installé
✅ dépôt cloné dans /opt/relaypress
```

### Domaines staging validés

```txt
api.relaypress.copinmalin.top
app.relaypress.copinmalin.top
relay.relaypress.copinmalin.top
```

### HTTPS

Caddy obtient les certificats Let’s Encrypt pour les domaines configurés.

Endpoints validés :

```txt
https://api.relaypress.copinmalin.top/health
https://app.relaypress.copinmalin.top/health
https://relay.relaypress.copinmalin.top
https://api.relaypress.copinmalin.top/admin
```

---

## 5. Stack Docker actuelle

Services :

```txt
caddy
postgres
redis
strfry
api
worker
```

Volumes :

```txt
caddy_data
caddy_config
postgres_data
redis_data
strfry_data
```

Rôles :

```txt
caddy    = reverse proxy HTTPS
postgres = base métier
redis    = queue/cache futur
strfry   = relay Nostr privé
api      = API Fastify + interface admin
worker   = indexation Nostr + publication mock
```

Commande de déploiement staging :

```bash
cd /opt/relaypress
git pull
docker compose up -d --build
```

Redéploiement API seul :

```bash
cd /opt/relaypress
git pull
docker compose up -d --build api
```

Redéploiement worker seul :

```bash
cd /opt/relaypress
git pull
docker compose up -d --build worker
```

---

## 6. Variables d’environnement structurantes

Ne jamais documenter les valeurs secrètes dans le dépôt.

Variables principales :

```txt
NODE_ENV
LOG_LEVEL
RELAYPRESS_DOMAIN
API_DOMAIN
PUBLISHER_DOMAIN
RELAY_DOMAIN
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
DATABASE_URL
REDIS_URL
NOSTR_PRIVATE_RELAY
NOSTR_PUBLIC_RELAYS
NOSTR_ALLOWED_PUBKEYS
NOSTR_INDEX_ALL
NOSTR_LOOKBACK_SECONDS
ADMIN_API_TOKEN
TOKEN_ENCRYPTION_KEY
SESSION_SECRET
AI_PROVIDER
PUBLISHER_MODE
OPENAI_API_KEY
MISTRAL_API_KEY
OLLAMA_BASE_URL
X_CLIENT_ID
X_CLIENT_SECRET
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET
META_APP_ID
META_APP_SECRET
METRICS_ENABLED
METRICS_PORT
```

Configuration staging actuelle importante :

```txt
PUBLISHER_MODE=mock
AI_PROVIDER=mock
NOSTR_INDEX_ALL=false
NOSTR_ALLOWED_PUBKEYS=<clé publique autorisée>
NOSTR_PRIVATE_RELAY=ws://strfry:7777
```

---

## 7. API actuelle

Service : `services/api`  
Stack : Fastify

### Endpoints publics

```txt
GET /
GET /health
GET /admin
```

`/admin` sert la page HTML, mais les données éditoriales ne sont pas lisibles sans token.

### Endpoints protégés par `ADMIN_API_TOKEN`

Lecture :

```txt
GET /publication-jobs
GET /publication-jobs/pending
GET /publication-jobs/:id
GET /publication-jobs/:id/runs
```

Écriture :

```txt
POST /publication-jobs/manual-draft
POST /publication-jobs/:id/content
POST /publication-jobs/:id/approve
POST /publication-jobs/:id/reject
POST /publication-jobs/:id/archive
```

### Vues métier API

```txt
GET /publication-jobs?view=todo
```

Retourne :

```txt
pending
pending_review
failed
```

```txt
GET /publication-jobs?view=archived
```

Retourne les jobs archivés.

Sans `view` et sans `status`, la liste exclut les archives par défaut.

### Exemple avec token

```bash
curl -s \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://api.relaypress.copinmalin.top/publication-jobs?view=todo&order=desc" | jq
```

---

## 8. Interface admin actuelle

URL :

```txt
https://api.relaypress.copinmalin.top/admin
```

Fonctions validées :

```txt
✅ lecture des jobs avec token
✅ vue À traiter
✅ vue Tous actifs
✅ vue Archives
✅ filtre par statut précis
✅ filtre par plateforme
✅ ordre asc/desc
✅ création de brouillon manuel
✅ création multi-plateforme
✅ édition du contenu avant validation
✅ approbation
✅ rejet avec raison
✅ publication mock après approbation
✅ visualisation des runs
✅ copie d’ID
✅ archivage individuel
✅ sélection des jobs terminés visibles
✅ archivage groupé
```

### Vue par défaut

```txt
À traiter = pending + pending_review + failed
```

### Jobs archivables dans l’interface

L’interface limite volontairement l’archivage aux jobs terminés :

```txt
published
rejected
failed
```

Les statuts suivants ne sont pas archivables depuis l’interface afin d’éviter les erreurs de manipulation :

```txt
pending
pending_review
approved
publishing
```

L’API accepte l’archivage sauf `publishing`, mais l’interface est volontairement plus prudente.

---

## 9. Modèle de données actuel

Package : `packages/db`  
Base : PostgreSQL

### 9.1 `nostr_events`

Rôle : journal applicatif des événements Nostr indexés.

Champs principaux :

```txt
id
pubkey
kind
content
tags
sig
created_at
indexed_at
raw
```

### 9.2 `publication_jobs`

Rôle : état métier d’un contenu à publier vers une plateforme.

Champs principaux :

```txt
id
source_event_id
platform
status
adapted_content
external_post_id
error_message
scheduled_at
published_at
created_at
updated_at
```

`source_event_id` peut être `null` pour les brouillons manuels créés depuis l’interface.

IDs observés :

```txt
<nostr_event_id>:x
<nostr_event_id>:linkedin
manual:<uuid>:x
manual:<uuid>:linkedin
```

### 9.3 `publication_job_runs`

Rôle : historique d’exécution de chaque tentative de publication.

Champs principaux :

```txt
id
job_id
platform
status
mode
external_post_id
error_message
started_at
finished_at
raw_response
```

Chaque tentative de publication doit créer une ligne de run.

---

## 10. Statuts métier actuels

```txt
pending         = job créé automatiquement, en attente de traitement éditorial
pending_review  = brouillon manuel ou contenu à relire
approved        = validé humainement, prêt pour le worker
publishing      = en cours de publication
published       = publié ou simulé via mock publisher
rejected        = refusé, à retravailler ou archiver
failed          = tentative échouée, à corriger ou retenter
archived        = conservé pour audit, masqué des vues actives
```

### Workflow principal

```txt
pending / pending_review
→ edit content
→ approve
→ approved
→ worker
→ publishing
→ published
→ archive
→ archived
```

### Workflow échec

```txt
approved
→ worker
→ publishing
→ failed
→ edit content
→ pending_review
→ approve
→ published
```

La mécanique de retry dédiée n’est pas encore implémentée.

---

## 11. Nostr indexer

Service : `services/worker`

Kinds écoutés :

```txt
kind:1       note courte
kind:30023   long-form publié
kind:30024   brouillon long-form
kind:30078   configuration applicative
kind:31922   événement calendrier daté
kind:31923   événement calendrier horaire
kind:30420   scénario éditorial RelayPress
kind:30421   campagne éditoriale RelayPress
kind:30422   règle de publication RelayPress
kind:30423   profil de ton RelayPress
kind:30424   programme éditorial RelayPress
```

Relays actuels :

```txt
ws://strfry:7777
wss://relay.damus.io
wss://nos.lol
wss://relay.primal.net
```

Filtrage :

```txt
NOSTR_INDEX_ALL=false
NOSTR_ALLOWED_PUBKEYS=<pubkey autorisée>
```

---

## 12. Création de jobs éditoriaux

Deux sources existent actuellement.

### 12.1 Depuis Nostr

Commande validée :

```txt
/publish x linkedin
Texte à publier
```

Résultat :

```txt
publication_jobs pour x
publication_jobs pour linkedin
adapted_content = texte nettoyé
```

Adaptation minimale actuelle : suppression de la ligne de commande `/publish ...`.

### 12.2 Depuis l’interface admin

Workflow validé :

```txt
Nouveau brouillon manuel
→ contenu
→ plateformes cochées
→ création de jobs pending_review
→ édition
→ approbation
→ publication mock
→ archivage
```

Les jobs manuels ont :

```txt
source_event_id = null
id = manual:<uuid>:<platform>
```

---

## 13. Publisher mock

Le publisher actuel ne publie pas réellement vers une plateforme externe.

Mode :

```txt
PUBLISHER_MODE=mock
```

Comportement :

```txt
approved
→ worker détecte le job
→ création publication_job_runs
→ status published
→ external_post_id = mock:<platform>:<job_id>
→ published_at renseigné
```

Objectif : tester tout le pipeline sans risque de publication publique.

---

## 14. Sécurité actuelle

### Validé

```txt
✅ UFW actif
✅ HTTPS via Caddy
✅ endpoints de jobs protégés par ADMIN_API_TOKEN
✅ interface admin ne lit pas les données sans token
✅ pas de token OAuth réel en base
✅ publisher réel non activé
```

### À renforcer plus tard

```txt
- authentification web propre au lieu du token dans localStorage
- rate limiting API
- protection CSRF si sessions web
- table publisher_accounts avec tokens chiffrés
- rotation des secrets
- sauvegardes PostgreSQL
- sauvegardes strfry_data
- monitoring
- alertes
```

Note : `ADMIN_API_TOKEN` dans localStorage est acceptable pour ce staging technique, mais pas pour une production multi-utilisateur.

---

## 15. Décisions d’architecture prises

### 15.1 Nostr reste la racine souveraine

L’interface admin ajoute une facilité opérationnelle, mais ne remplace pas la vision Nostr comme plan de contrôle.

### 15.2 PostgreSQL porte l’état métier

Le relay Nostr n’est pas utilisé comme base métier. Il reste un journal et un bus d’intentions.

### 15.3 Le publisher mock précède les publishers réels

Décision validée : aucun branchement réel LinkedIn/X/Meta tant que l’édition, l’audit et l’anti-doublon ne sont pas solides.

### 15.4 L’interface admin est minimaliste mais suffisante

À ce stade, l’admin sert à faire le nécessaire : créer, lire, éditer, valider, publier mock, archiver, auditer.

### 15.5 L’archivage est non destructif

Un job archivé reste dans la base avec ses runs. Il est seulement masqué des vues actives.

### 15.6 Les lectures de jobs sont privées

Les contenus éditoriaux ne doivent pas être exposés publiquement, même en staging.

---

## 16. Phases projet

## Phase 0 — Cadrage conceptuel

Statut :

```txt
✅ Terminé
```

Résultats :

```txt
- vision RelayPress clarifiée
- refus du simple crossposter
- Nostr défini comme plan de contrôle
- IA future définie comme adaptation sous contraintes
```

---

## Phase 1 — Socle dépôt et CI

Statut :

```txt
✅ Terminé
```

Résultats :

```txt
- dépôt GitHub créé
- licence AGPL-3.0
- monorepo pnpm
- Node 24
- TypeScript NodeNext
- pnpm-lock.yaml
- CI GitHub Actions
- docker compose config/build vérifié
```

---

## Phase 2 — Infrastructure Docker

Statut :

```txt
✅ Terminé et validé en staging
```

Résultats :

```txt
- Caddy
- PostgreSQL
- Redis
- strfry
- API
- Worker
- volumes persistants
- HTTPS validé
```

---

## Phase 3 — Indexation Nostr

Statut :

```txt
✅ Terminé et validé runtime
```

Résultats :

```txt
- connexion aux relays
- filtrage par pubkey
- stockage dans nostr_events
- logs worker structurés
```

---

## Phase 4 — Jobs de publication

Statut :

```txt
✅ Terminé pour MVP
```

Résultats :

```txt
- publication_jobs créés depuis Nostr
- publication_jobs créés depuis brouillon manuel
- adaptation minimale du contenu
- multi-plateforme par job séparé
```

---

## Phase 5 — Interface admin minimale

Statut :

```txt
✅ Terminé pour MVP
```

Résultats :

```txt
- lecture jobs
- vues métier
- brouillons manuels
- édition
- validation
- rejet
- runs
- archivage individuel
- archivage groupé
```

---

## Phase 6 — Audit d’exécution

Statut :

```txt
✅ Terminé pour MVP
```

Résultats :

```txt
- table publication_job_runs
- run créé à chaque tentative mock
- raw_response conservée
- consultation des runs depuis l’admin
```

---

## Phase 7 — Stabilisation éditoriale

Statut :

```txt
⏳ Prochaine phase recommandée
```

Objectif : rendre l’outil confortable et sûr avant publication réelle.

À faire :

```txt
1. Prévisualisation par plateforme
2. Compteur de caractères
3. Warnings de contenu vide/trop long
4. Limites X configurables
5. Prévisualisation LinkedIn long format
6. Bouton dupliquer en brouillon
7. Marqueurs visuels “prêt / à corriger”
```

---

## Phase 8 — Anti-doublon / retry / reset

Statut :

```txt
⏳ À faire avant publisher réel
```

À faire :

```txt
1. Empêcher publication si external_post_id existe
2. Bloquer double publication d’un job published
3. Ajouter retry sur failed
4. Ajouter reset to pending_review sur rejected/failed
5. Ajouter mécanisme de verrouillage plus strict côté worker
6. Éventuellement séparer archived_at de status plus tard
```

---

## Phase 9 — Adaptateurs de contenu sérieux

Statut :

```txt
⏳ À faire
```

Règles cibles :

```txt
X:
- texte court
- compteur
- limite configurable
- warning avant coupe

LinkedIn:
- format long
- paragraphes aérés
- ton professionnel

Facebook:
- texte plus conversationnel

Instagram:
- caption seulement pour l’instant
- média obligatoire plus tard
```

---

## Phase 10 — Publisher réel LinkedIn

Statut :

```txt
⏳ À faire après stabilisation
```

Recommandation : commencer par LinkedIn.

Raisons :

```txt
- plus adapté à B-Conseil / AlpineChain / B-Only
- meilleure valeur business
- format long accepté
- moins fragile éditorialement que X
```

À prévoir :

```txt
- OAuth LinkedIn
- table publisher_accounts
- stockage chiffré des tokens
- refresh tokens
- mapping compte/page
- publication réelle en staging
- erreurs API dans publication_job_runs
```

---

## Phase 11 — Publishers X / Meta / Instagram

Statut :

```txt
⏳ Plus tard
```

Ordre recommandé :

```txt
1. LinkedIn
2. X
3. Facebook Page
4. Instagram Business
5. Mastodon / WordPress
```

---

## Phase 12 — Production durcie

Statut :

```txt
⏳ Plus tard
```

À prévoir :

```txt
- sauvegarde PostgreSQL automatisée
- sauvegarde volumes strfry
- monitoring conteneurs
- monitoring disque
- alertes
- rotation logs
- rate limiting
- authentification web propre
- documentation d’exploitation
- procédure de restauration
```

---

## 17. Commandes d’exploitation utiles

### Déploiement

```bash
cd /opt/relaypress
git pull
docker compose up -d --build
```

### État services

```bash
cd /opt/relaypress
docker compose ps
```

### Logs

```bash
docker compose logs --tail=120 api
docker compose logs --tail=120 worker
docker compose logs --tail=120 caddy
docker compose logs --tail=120 strfry
docker compose logs --tail=120 postgres
```

### Healthcheck

```bash
curl -i https://api.relaypress.copinmalin.top/health
curl -i https://app.relaypress.copinmalin.top/health
curl -i https://relay.relaypress.copinmalin.top
```

### Liste des jobs à traiter

```bash
curl -s \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://api.relaypress.copinmalin.top/publication-jobs?view=todo&order=desc" | jq
```

### Liste des archives

```bash
curl -s \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://api.relaypress.copinmalin.top/publication-jobs?view=archived&order=desc" | jq
```

### Vérification DB jobs

```bash
docker compose exec postgres psql -U relaypress -d relaypress -c \
"select id, platform, status, external_post_id, published_at, updated_at
 from publication_jobs
 order by updated_at desc
 limit 20;"
```

### Vérification DB events Nostr

```bash
docker compose exec postgres psql -U relaypress -d relaypress -c \
"select id, kind, pubkey, created_at, indexed_at
 from nostr_events
 order by indexed_at desc
 limit 10;"
```

### Vérification DB runs

```bash
docker compose exec postgres psql -U relaypress -d relaypress -c \
"select id, job_id, platform, status, mode, external_post_id, started_at, finished_at
 from publication_job_runs
 order by started_at desc
 limit 20;"
```

---

## 18. Journal de suivi synthétique

### Bootstrap projet

```txt
- création dépôt Copinmalin/relaypress
- choix AGPL-3.0
- README initial
- documentation initiale
- monorepo pnpm
```

### CI / build

```txt
- ajout GitHub Actions
- correction pnpm-lock.yaml absent
- passage Node 24
- FORCE_JAVASCRIPT_ACTIONS_TO_NODE24
- correction imports ESM NodeNext
- correction typage nostr-tools Filter
- docker compose build api worker dans CI
```

### Infrastructure

```txt
- préparation VPS IONOS
- UFW
- Docker / Docker Compose
- clone dans /opt/relaypress
- Caddy HTTPS
- DNS OVH
- strfry configuré
```

### Nostr / DB

```txt
- indexation Nostr active
- filtrage par pubkey
- correction clé publique autorisée
- événements stockés dans nostr_events
- création publication_jobs
```

### Pipeline éditorial

```txt
- adaptation minimale de contenu
- création jobs depuis Nostr
- création brouillons manuels
- édition avant approbation
- approbation/rejet
- publication mock
- publication_job_runs
- archivage individuel
- archivage groupé
```

### Sécurité

```txt
- endpoints jobs protégés par ADMIN_API_TOKEN
- lecture sans token refusée
- admin lit les données avec Authorization Bearer
```

---

## 19. Risques connus

### 19.1 Interface admin encore rudimentaire

Elle est fonctionnelle, mais reste un HTML embarqué dans l’API. C’est acceptable pour MVP, pas pour produit final.

### 19.2 Token admin dans localStorage

Acceptable en staging solo, insuffisant pour production.

### 19.3 Pas encore d’anti-doublon fort

Un job published doit être davantage protégé avant publisher réel.

### 19.4 Pas encore de retry propre

Les échecs peuvent être édités et remis en `pending_review`, mais il n’existe pas encore d’action métier `retry`.

### 19.5 Pas de sauvegardes automatisées

Point à traiter avant toute utilisation sérieuse prolongée.

### 19.6 Pas de publisher réel

C’est volontaire. Le mock publisher reste la bonne étape actuelle.

---

## 20. Prochaine roadmap recommandée

### Étape A — Prévisualisation éditoriale par plateforme

Priorité : haute.

À ajouter dans l’admin :

```txt
- compteur caractères
- warning contenu vide
- warning X trop long
- preview LinkedIn
- preview X
- indication “prêt à publier”
```

### Étape B — Anti-doublon / retry / reset

Priorité : haute avant publisher réel.

```txt
- empêcher double publication
- retry uniquement sur failed
- reset to pending_review
- verrouiller les transitions invalides
```

### Étape C — Adaptateur LinkedIn propre

Priorité : moyenne-haute.

```txt
- paragraphes
- liens
- hashtags
- ton professionnel
- règles B-Conseil / AlpineChain / B-Only plus tard
```

### Étape D — OAuth LinkedIn

Priorité : après A/B/C.

```txt
- table publisher_accounts
- chiffrement token
- connexion LinkedIn
- test publication staging
```

### Étape E — Sauvegardes staging

Priorité : moyenne, mais à faire avant usage régulier.

```txt
- dump PostgreSQL
- backup volume strfry
- procédure restauration
```

---

## 21. Définition actuelle de “done” MVP

Le MVP technique éditorial est considéré comme validé si :

```txt
✅ un event Nostr autorisé peut créer des jobs
✅ un brouillon manuel peut créer des jobs
✅ les jobs sont visibles uniquement avec token
✅ un contenu peut être édité avant validation
✅ un job peut être approuvé
✅ le worker publie en mock
✅ un run est créé
✅ le job passe en published
✅ les jobs terminés peuvent être archivés
✅ les archives restent consultables
```

À la date du 2026-05-05, cette définition est atteinte.

---

## 22. Décision de suite

Ne pas brancher encore LinkedIn réel.

Prochaine brique recommandée :

```txt
Prévisualisation + validation éditoriale par plateforme
```

Justification : publier réellement sans preview, compteur, anti-doublon et transitions verrouillées serait prématuré.

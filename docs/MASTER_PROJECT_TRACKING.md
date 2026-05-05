# RelayPress — Document maître de suivi projet

Ce document est la **source de vérité opérationnelle** du projet RelayPress.

Il doit être mis à jour à chaque étape structurante : changement d’architecture, nouveau workflow validé, nouveau statut métier, changement de sécurité, déploiement, ou décision produit importante.

**Dernière mise à jour : 2026-05-05**  
**État global : MVP éditorial souverain fonctionnel en staging, Phase D publisher abstraction validée**

---

## 1. Vision du projet

RelayPress est un système d’orchestration éditoriale souverain, piloté par Nostr, destiné à préparer, valider, adapter, publier et auditer des contenus vers plusieurs plateformes.

RelayPress n’est pas un simple crossposter. Le principe est de séparer clairement :

```txt
Nostr = intention signée + journal souverain + plan de contrôle
Relay privé = registre canonique des événements éditoriaux
PostgreSQL = état métier opérationnel
Worker = moteur d’indexation, de transformation et de publication
API admin = pilotage éditorial humain
Publishers = sorties vers plateformes externes
IA = adaptation sous contraintes, plus tard
```

État fonctionnel actuel :

```txt
Nostr event ou brouillon manuel
→ création de jobs éditoriaux
→ adaptation minimale / déterministe selon plateforme
→ comparaison source originale / version adaptée
→ édition humaine
→ validation
→ publication mock
→ audit des exécutions
→ archivage non destructif
```

Le système ne publie pas encore réellement vers LinkedIn, X, Facebook ou Instagram. La couche de publisher réel LinkedIn est préparée, mais volontairement non connectée.

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
- Un job déjà publié ne doit jamais être republié accidentellement.
- Le lockfile `pnpm-lock.yaml` est obligatoire.
- Node 24 est la cible runtime et CI.
- Docker Compose est la base de reproductibilité staging.
- Le mode `mock` reste le mode par défaut tant que LinkedIn réel n’est pas durci.

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
✅ sourceContent conservé séparément de adaptedContent
✅ Adaptateur minimal multi-plateforme
✅ Adaptateur LinkedIn déterministe
✅ Action readapt depuis sourceContent
✅ Publisher mock isolé derrière interface commune
✅ Orchestrateur publisher
✅ Stub LinkedIn réel non actif
✅ Historique publication_job_runs
✅ Interface admin extraite en assets CSS/JS
✅ Brouillons manuels depuis l’admin
✅ Édition avant validation
✅ Validation / rejet
✅ Retry sur failed
✅ Reset review sur rejected / failed
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
│   │   └── src/
│   │       ├── admin-assets.ts
│   │       ├── admin-page-v2.ts
│   │       ├── content-adapter.ts
│   │       └── publication-jobs.ts
│   └── worker/
│       └── src/
│           ├── nostr/
│           └── publisher/
│               ├── index.ts
│               ├── linkedin-publisher.ts
│               ├── mock-publisher.ts
│               └── types.ts
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
https://api.relaypress.copinmalin.top/assets/admin.css
https://api.relaypress.copinmalin.top/assets/admin.js
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
api      = API Fastify + interface admin + assets admin
worker   = indexation Nostr + orchestration publisher
```

Commande de déploiement staging complet :

```bash
cd /opt/relaypress
git pull
docker compose up -d --build

export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"
echo "Token length: ${#ADMIN_API_TOKEN}"
```

Redéploiement API seul :

```bash
cd /opt/relaypress
git pull
docker compose up -d --build api

export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"
echo "Token length: ${#ADMIN_API_TOKEN}"
```

Redéploiement worker seul :

```bash
cd /opt/relaypress
git pull
docker compose up -d --build worker

export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"
echo "Token length: ${#ADMIN_API_TOKEN}"
```

Note opérationnelle : le token admin shell est souvent perdu entre sessions. Les commandes de test doivent donc toujours commencer par le recharger depuis `.env`.

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
PUBLISHER_BATCH_SIZE
WORKER_TICK_INTERVAL_MS
LINKEDIN_ACCESS_TOKEN
LINKEDIN_AUTHOR_URN
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

Variables LinkedIn préparées mais non utilisées en production réelle :

```txt
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_AUTHOR_URN=
```

En mode `PUBLISHER_MODE=linkedin_real`, si ces variables sont absentes, le worker ne claim pas les jobs et logue `publisher_not_ready`.

---

## 7. API actuelle

Service : `services/api`  
Stack : Fastify

### Endpoints publics

```txt
GET /
GET /health
GET /admin
GET /assets/admin.css
GET /assets/admin.js
```

`/admin` sert la page HTML. Les assets admin sont servis avec `Cache-Control: no-store` pour limiter les problèmes de cache pendant le staging.

Les données éditoriales ne sont pas lisibles sans token.

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
POST /publication-jobs/:id/readapt
POST /publication-jobs/:id/approve
POST /publication-jobs/:id/reject
POST /publication-jobs/:id/retry
POST /publication-jobs/:id/reset-review
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

Filtres disponibles :

```txt
status=<status>
platform=x|linkedin|facebook|instagram
order=asc|desc
limit=<1..200>
```

### Exemple avec token

```bash
cd /opt/relaypress

export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"
echo "Token length: ${#ADMIN_API_TOKEN}"

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

Implémentation actuelle :

```txt
GET /admin              → admin-page-v2.ts
GET /assets/admin.css   → admin-assets.ts
GET /assets/admin.js    → admin-assets.ts
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
✅ comparaison source originale / version adaptée
✅ édition du adaptedContent avant validation
✅ réadaptation depuis sourceContent
✅ prévisualisation simple par plateforme
✅ compteur de caractères
✅ warnings simples : contenu vide, X trop long, routage encore présent, Instagram non géré
✅ approbation
✅ rejet avec raison
✅ retry sur failed
✅ reset review sur rejected / failed
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
source_content
adapted_content
external_post_id
error_message
scheduled_at
published_at
created_at
updated_at
```

Points importants :

```txt
source_content  = texte source nettoyé et conservé
adapted_content = texte éditorial réellement utilisé pour validation/publication
source_event_id = null pour les brouillons manuels créés depuis l’admin
```

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
→ edit content / readapt from source
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
→ retry
→ approved
→ worker
```

ou :

```txt
failed / rejected
→ reset-review
→ pending_review
→ edit / readapt
→ approve
→ worker
→ published
```

### Transitions sécurisées

```txt
approve       : pending / pending_review seulement, si non publié
reject        : pending / pending_review / approved seulement, si non publié
retry         : failed seulement, si non publié
reset-review  : rejected / failed seulement, si non publié
readapt       : pending / pending_review / rejected / failed seulement, si non publié
archive       : interdit si publishing
```

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

ou via tags :

```txt
#publish #x
```

Résultat :

```txt
publication_jobs pour x
publication_jobs pour linkedin
source_content = texte nettoyé
adapted_content = texte adapté à la plateforme
```

Nettoyage actuel :

```txt
- suppression de la ligne /publish ...
- suppression de #publish et #relaypress
- normalisation whitespace
```

### 12.2 Depuis l’interface admin

Workflow validé :

```txt
Nouveau brouillon manuel
→ contenu source
→ plateformes cochées
→ création de jobs pending_review
→ comparaison source/adapted
→ édition ou réadaptation
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

## 13. Adaptateurs de contenu actuels

### 13.1 Base commune

Fonctions actuelles :

```txt
cleanSourceContent(content)
adaptPublicationContent(sourceContent, platform)
```

Nettoyage commun :

```txt
- retire /publish ...
- retire #publish
- retire #relaypress
- normalise les lignes et les paragraphes
```

### 13.2 X

```txt
adaptedContent = sourceContent nettoyé
warning si > 140 caractères
```

La limite 140 est une règle éditoriale temporaire, pas une limite technique définitive.

### 13.3 LinkedIn

Adaptateur déterministe sans IA.

Sortie :

```txt
accroche

paragraphes éventuels

appel à discussion

hashtags
```

Exemple validé :

```txt
sourceContent:
bitcoin permet de reprendre la main sur sa souveraineté numérique

adaptedContent:
Bitcoin permet de reprendre la main sur sa souveraineté numérique.

Et vous, comment abordez-vous ce sujet ?

#Bitcoin #SouverainetéNumérique #RelayPress
```

Correction appliquée : un texte en un seul paragraphe n’est plus dupliqué entre accroche et corps.

### 13.4 Facebook

```txt
adaptedContent = sourceContent nettoyé
```

### 13.5 Instagram

```txt
adaptedContent = sourceContent nettoyé
warning : média/caption à traiter plus tard
```

### 13.6 Réadaptation

Endpoint :

```txt
POST /publication-jobs/:id/readapt
```

Rôle : régénérer `adapted_content` depuis `source_content` sans recréer un job.

Sécurité : interdit sur les jobs publiés, approuvés, en publication ou archivés.

---

## 14. Publisher actuel

### 14.1 Orchestrateur publisher

Le worker n’appelle plus directement le mock publisher. Il appelle :

```txt
services/worker/src/publisher/index.ts
```

Cet orchestrateur :

```txt
- lit PUBLISHER_MODE
- sélectionne un publisher
- vérifie publisher.isReady()
- claim uniquement les jobs compatibles avec supportedPlatforms
- crée publication_job_runs
- publie ou échoue proprement
- écrit raw_response
```

### 14.2 Publisher mock

Mode :

```txt
PUBLISHER_MODE=mock
```

Comportement :

```txt
approved
→ worker détecte le job
→ status publishing
→ création publication_job_runs started
→ mock publisher
→ status published
→ external_post_id = mock:<platform>:<job_id>
→ publication_job_runs status published
→ published_at renseigné
```

Objectif : tester tout le pipeline sans risque de publication publique.

### 14.3 Stub LinkedIn réel

Mode préparé :

```txt
PUBLISHER_MODE=linkedin_real
```

Fichiers :

```txt
services/worker/src/publisher/linkedin-publisher.ts
services/worker/src/publisher/types.ts
```

Comportement actuel :

```txt
- ne publie pas encore réellement
- vérifie LINKEDIN_ACCESS_TOKEN
- vérifie LINKEDIN_AUTHOR_URN
- si config absente : worker skip sans claim les jobs
- si appelé sans implémentation réelle : erreur explicite
```

Décision : ne pas connecter l’API LinkedIn réelle tant que l’OAuth, le stockage chiffré et les erreurs API ne sont pas correctement modélisés.

---

## 15. Sécurité actuelle

### Validé

```txt
✅ UFW actif
✅ HTTPS via Caddy
✅ endpoints de jobs protégés par ADMIN_API_TOKEN
✅ interface admin ne lit pas les données sans token
✅ assets admin publics mais sans contenu éditorial
✅ pas de token OAuth réel en base
✅ publisher réel non activé
✅ worker ne claim pas en mode linkedin_real si config incomplète
✅ jobs déjà publiés protégés contre approve/retry/readapt/reset
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

Note : `ADMIN_API_TOKEN` dans localStorage est acceptable pour ce staging technique mono-utilisateur, mais pas pour une production multi-utilisateur.

---

## 16. Décisions d’architecture prises

### 16.1 Nostr reste la racine souveraine

L’interface admin ajoute une facilité opérationnelle, mais ne remplace pas la vision Nostr comme plan de contrôle.

### 16.2 PostgreSQL porte l’état métier

Le relay Nostr n’est pas utilisé comme base métier. Il reste un journal et un bus d’intentions.

### 16.3 `sourceContent` et `adaptedContent` sont séparés

Décision validée : ne jamais perdre la source originale nettoyée. L’adaptation doit rester réversible et auditable.

### 16.4 Le publisher mock précède les publishers réels

Décision validée : aucun branchement réel LinkedIn/X/Meta tant que l’édition, l’audit, l’anti-doublon et la configuration publisher ne sont pas solides.

### 16.5 L’interface admin est volontairement utilitaire

L’admin sert à créer, lire, éditer, valider, réadapter, publier en mock, archiver et auditer. Le polish produit viendra après le publisher réel.

### 16.6 L’archivage est non destructif

Un job archivé reste dans la base avec ses runs. Il est seulement masqué des vues actives.

### 16.7 Les lectures de jobs sont privées

Les contenus éditoriaux ne doivent pas être exposés publiquement, même en staging.

### 16.8 Les assets admin sont séparés

Décision prise après régression UI : sortir le CSS et le JS de la page HTML pour éviter que l’interface ne devienne incontrôlable.

---

## 17. Phases projet

### Phase 0 — Cadrage conceptuel

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

### Phase 1 — Socle dépôt et CI

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

### Phase 2 — Infrastructure Docker

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

### Phase 3 — Indexation Nostr

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

### Phase 4 — Jobs de publication

Statut :

```txt
✅ Terminé pour MVP
```

Résultats :

```txt
- publication_jobs créés depuis Nostr
- publication_jobs créés depuis brouillon manuel
- source_content conservé
- adapted_content par plateforme
- multi-plateforme par job séparé
```

### Phase 5 — Interface admin minimale

Statut :

```txt
✅ Terminé pour MVP et stabilisé en admin v2
```

Résultats :

```txt
- lecture jobs
- vues métier
- brouillons manuels
- édition
- validation
- rejet
- readapt
- retry
- reset review
- runs
- archivage individuel
- archivage groupé
- assets CSS/JS séparés
```

### Phase 6 — Audit d’exécution

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

### Phase A — Prévisualisation éditoriale par plateforme

Statut :

```txt
✅ Terminé MVP
```

Résultats :

```txt
- compteur caractères
- warning contenu vide
- warning X trop long
- warning routage encore visible
- warning Instagram média non géré
- preview simple dans l’admin
```

### Phase B — Anti-doublon / retry / reset

Statut :

```txt
✅ Terminé MVP
```

Résultats :

```txt
- publication interdite si external_post_id existe
- publication interdite si published_at existe
- approve bloqué sur published
- retry uniquement sur failed
- reset-review sur rejected / failed
- worker protégé par claim status approved + external_post_id null + published_at null
- transitions invalides retournent 409
```

### Phase C — Adaptateur LinkedIn propre sans IA

Statut :

```txt
✅ Terminé MVP
```

Résultats :

```txt
- sourceContent conservé
- adaptedContent LinkedIn structuré
- accroche
- paragraphes courts
- appel à discussion
- hashtags
- correction de la duplication sur texte court
- readapt depuis sourceContent
```

### Phase D — Couche publisher propre

Statut :

```txt
✅ Terminé architecture
```

Résultats :

```txt
- interface PublicationPublisher
- createMockPublisher()
- createLinkedInPublisher() stub
- publisher orchestrator
- supportedPlatforms par publisher
- isReady avant claim
- PUBLISHER_MODE=mock conservé
- PUBLISHER_MODE=linkedin_real préparé mais non actif
- LINKEDIN_ACCESS_TOKEN et LINKEDIN_AUTHOR_URN préparés
```

### Phase E — Publisher réel LinkedIn

Statut :

```txt
⏳ Prochaine phase recommandée
```

À faire :

```txt
1. Choisir le mode d’auth LinkedIn adapté : membre ou page organisation
2. Finaliser l’app LinkedIn Developer
3. Définir LINKEDIN_AUTHOR_URN exact
4. Implémenter l’appel API LinkedIn réel dans linkedin-publisher.ts
5. Gérer les erreurs API dans publication_job_runs.raw_response
6. Garder PUBLISHER_MODE=mock par défaut
7. Tester en staging sur un compte/page contrôlé
8. Ne passer en réel qu’avec validation humaine explicite
```

### Phase F — Comptes publishers et chiffrement tokens

Statut :

```txt
⏳ À faire avant production
```

À prévoir :

```txt
- table publisher_accounts
- provider
- account_urn
- display_name
- encrypted_access_token
- encrypted_refresh_token si applicable
- token_expires_at
- scopes
- created_at / updated_at
- chiffrement avec TOKEN_ENCRYPTION_KEY
```

### Phase G — Publishers X / Meta / Instagram

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

### Phase H — Production durcie

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

## 18. Commandes d’exploitation utiles

### Recharger le token admin

À faire au début de chaque session shell :

```bash
cd /opt/relaypress

export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"
echo "Token length: ${#ADMIN_API_TOKEN}"
```

### Déploiement complet

```bash
cd /opt/relaypress
git pull
docker compose up -d --build

export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"
echo "Token length: ${#ADMIN_API_TOKEN}"
```

### État services

```bash
cd /opt/relaypress
docker compose ps
```

### Logs

```bash
cd /opt/relaypress

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

### Vérifier assets admin

```bash
curl -i https://api.relaypress.copinmalin.top/assets/admin.css | head
curl -i https://api.relaypress.copinmalin.top/assets/admin.js | head
```

### Liste des jobs à traiter

```bash
cd /opt/relaypress

export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"
echo "Token length: ${#ADMIN_API_TOKEN}"

curl -s \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://api.relaypress.copinmalin.top/publication-jobs?view=todo&order=desc" | jq
```

### Liste LinkedIn à traiter

```bash
cd /opt/relaypress

export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"
echo "Token length: ${#ADMIN_API_TOKEN}"

curl -s \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://api.relaypress.copinmalin.top/publication-jobs?view=todo&platform=linkedin&order=desc" \
  | jq '.jobs[] | {id, platform, status}'
```

### Réadapter un job LinkedIn depuis sa source

```bash
cd /opt/relaypress

export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"
echo "Token length: ${#ADMIN_API_TOKEN}"

JOB_ID="$(curl -s \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://api.relaypress.copinmalin.top/publication-jobs?view=todo&platform=linkedin&order=desc" \
  | jq -r '.jobs[0].id')"

echo "JOB_ID=$JOB_ID"

JOB_ID_ENCODED="$(python3 -c 'import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$JOB_ID")"

curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://api.relaypress.copinmalin.top/publication-jobs/$JOB_ID_ENCODED/readapt" | jq
```

### Liste des archives

```bash
cd /opt/relaypress

export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"
echo "Token length: ${#ADMIN_API_TOKEN}"

curl -s \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://api.relaypress.copinmalin.top/publication-jobs?view=archived&order=desc" | jq
```

### Vérification DB jobs

```bash
cd /opt/relaypress

docker compose exec postgres psql -U relaypress -d relaypress -c \
"select id, platform, status, source_content, adapted_content, external_post_id, published_at, updated_at
 from publication_jobs
 order by updated_at desc
 limit 20;"
```

### Vérification DB events Nostr

```bash
cd /opt/relaypress

docker compose exec postgres psql -U relaypress -d relaypress -c \
"select id, kind, pubkey, created_at, indexed_at
 from nostr_events
 order by indexed_at desc
 limit 10;"
```

### Vérification DB runs

```bash
cd /opt/relaypress

docker compose exec postgres psql -U relaypress -d relaypress -c \
"select id, job_id, platform, status, mode, external_post_id, error_message, started_at, finished_at
 from publication_job_runs
 order by started_at desc
 limit 20;"
```

### Test publisher mode mock

```bash
cd /opt/relaypress

docker compose logs --tail=120 worker | grep 'publisherMode'
```

Attendu :

```txt
publisherMode":"mock"
```

### Test garde-fou LinkedIn réel non prêt

À utiliser seulement comme test ponctuel :

```bash
cd /opt/relaypress

cp .env .env.backup-phase-d
sed -i 's/^PUBLISHER_MODE=.*/PUBLISHER_MODE=linkedin_real/' .env

docker compose up -d --build worker
docker compose logs --tail=80 worker

mv .env.backup-phase-d .env
docker compose up -d --build worker
```

Attendu pendant le test :

```txt
status":"skipped"
reason":"LINKEDIN_ACCESS_TOKEN is missing"
```

---

## 19. Journal de suivi synthétique

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
- ajout source_content
- ajout publication_job_runs
```

### Pipeline éditorial

```txt
- adaptation minimale de contenu
- création jobs depuis Nostr
- création brouillons manuels
- édition avant approbation
- source/adapted comparison
- readapt depuis source
- approbation/rejet
- retry/reset review
- publication mock
- archivage individuel
- archivage groupé
```

### Interface admin

```txt
- première interface HTML embarquée
- régression UI après grossissement du fichier
- création admin v2 compacte
- extraction CSS/JS vers assets
- routes /assets/admin.css et /assets/admin.js enregistrées
- filtres restaurés
```

### Publisher

```txt
- mock publisher initial
- séparation via PublicationPublisher
- mock converti en publisher isolé
- ajout orchestrateur publisher
- ajout stub LinkedIn réel
- garde-fou isReady avant claim
```

### Sécurité

```txt
- endpoints jobs protégés par ADMIN_API_TOKEN
- lecture sans token refusée
- admin lit les données avec Authorization Bearer
- jobs publiés protégés contre republication accidentelle
- mode LinkedIn réel non prêt ne claim pas les jobs
```

---

## 20. Risques connus

### 20.1 Interface admin encore utilitaire

Elle est fonctionnelle et stabilisée via assets séparés, mais elle reste une interface technique. Pour un usage produit, il faudra une vraie application frontend.

### 20.2 Token admin dans localStorage

Acceptable en staging solo, insuffisant pour production.

### 20.3 Pas encore de sauvegardes automatisées

Point à traiter avant toute utilisation sérieuse prolongée.

### 20.4 Pas encore de publisher réel

C’est volontaire. Le mock publisher reste le bon mode par défaut.

### 20.5 OAuth LinkedIn non traité

La publication réelle LinkedIn ne doit pas être implémentée sans décision claire sur : membre vs page, scopes, author URN, stockage et rotation des tokens.

### 20.6 Chiffrement des tokens non encore implémenté

`TOKEN_ENCRYPTION_KEY` existe, mais le modèle `publisher_accounts` n’est pas encore en place.

---

## 21. Prochaine roadmap recommandée

### Étape E — Publisher réel LinkedIn contrôlé

Priorité : haute, prochaine phase logique.

À faire :

```txt
1. Clarifier cible de publication : profil personnel ou page LinkedIn
2. Finaliser vérification app LinkedIn Developer si nécessaire
3. Déterminer scopes exacts
4. Obtenir author URN
5. Implémenter appel API LinkedIn minimal dans linkedin-publisher.ts
6. Journaliser réponse brute dans publication_job_runs.raw_response
7. Gérer erreurs API : 401, 403, 429, 5xx, validation content
8. Tester uniquement avec PUBLISHER_MODE=linkedin_real sur staging
9. Revenir à PUBLISHER_MODE=mock par défaut après test
```

### Étape F — Comptes publishers et chiffrement

Priorité : haute avant production.

```txt
- table publisher_accounts
- chiffrement tokens
- gestion expiration
- éventuel refresh token
- association plateforme / compte / page
```

### Étape G — Sauvegardes staging

Priorité : moyenne-haute.

```txt
- dump PostgreSQL
- backup volume strfry
- procédure restauration
- test restauration
```

### Étape H — Qualité admin

Priorité : moyenne.

```txt
- meilleure UX d’erreur
- confirmation plus claire avant approve/publish
- statut “prêt” calculé côté API
- historique visuel plus lisible
- future extraction vers frontend dédié
```

### Étape I — Adaptateur IA contrôlé

Priorité : plus tard.

```txt
- jamais avant publisher réel stable
- prompt versionné
- règles strictes par plateforme
- validation humaine obligatoire
- conservation source/adapted/diff
```

---

## 22. Définition actuelle de “done” MVP

Le MVP technique éditorial est validé si :

```txt
✅ un event Nostr autorisé peut créer des jobs
✅ un brouillon manuel peut créer des jobs
✅ les jobs sont visibles uniquement avec token
✅ sourceContent est conservé
✅ adaptedContent peut être édité ou réadapté
✅ un contenu peut être approuvé
✅ le worker publie en mock
✅ un run est créé
✅ le job passe en published
✅ un job failed peut être retried
✅ un job rejected/failed peut revenir en review
✅ les jobs terminés peuvent être archivés
✅ les archives restent consultables
✅ le worker passe par une couche publisher abstraite
```

À la date du 2026-05-05, cette définition est atteinte.

---

## 23. Décision de suite

Ne pas brancher brutalement LinkedIn réel.

Prochaine brique recommandée :

```txt
Phase E — implémenter LinkedInPublisher réel de façon contrôlée
```

Justification : la couche éditoriale, l’admin, l’audit, l’anti-doublon et l’abstraction publisher sont maintenant suffisamment propres pour préparer un premier test LinkedIn réel. Le mode `mock` doit rester le défaut tant que l’OAuth, les author URN et les erreurs API ne sont pas complètement maîtrisés.

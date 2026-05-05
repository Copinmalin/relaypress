# RelayPress — Document maître de suivi projet

Ce document est la source de vérité opérationnelle du projet RelayPress.

Il sert à suivre :

- la vision générale ;
- les décisions d’architecture ;
- l’état réel du dépôt ;
- les phases principales ;
- les points validés ;
- les points ouverts ;
- les prochaines actions ;
- les changements importants au fil de l’avancement.

Il doit être mis à jour régulièrement à chaque étape structurante.

---

## 1. Vision du projet

RelayPress est un système d’orchestration éditoriale souverain piloté par Nostr.

L’objectif n’est pas de créer un simple crossposter Nostr vers réseaux sociaux. L’objectif est de construire une infrastructure où Nostr sert de source de vérité, de journal d’intention, de bus d’événements et de plan de contrôle pour produire, programmer, valider et diffuser du contenu vers des plateformes externes.

### Formule de conception

```txt
Nostr = intention signée + journal souverain + plan de contrôle
Relay privé = registre canonique des événements éditoriaux
PostgreSQL = état métier opérationnel
Worker = moteur d’indexation, scénario, IA et publication
IA = génération/adaptation sous contraintes
API sociales = canaux de distribution secondaires
```

### Plateformes cibles

- Nostr ;
- X ;
- LinkedIn ;
- Facebook Page ;
- Instagram Business ;
- Mastodon / Fediverse ;
- WordPress ou autre CMS dans une phase ultérieure.

---

## 2. Principes non négociables

- Pas de stockage de `nsec` en clair.
- Pas de scraping de réseaux sociaux.
- Utilisation des API officielles quand il y a publication externe.
- Nostr doit rester la racine souveraine, les réseaux sociaux seulement des sorties.
- Toutes les intentions importantes doivent pouvoir être tracées.
- La publication autonome doit être encadrée par des règles explicites.
- Les contenus sensibles doivent rester soumis à validation humaine.
- Les dépendances doivent être verrouillées par `pnpm-lock.yaml`.
- L’infrastructure doit être reproductible avec Docker Compose.

---

## 3. État actuel du dépôt

Date de référence : phase bootstrap initiale du projet.

Dépôt : `Copinmalin/relaypress`

### Socle validé

```txt
✅ Monorepo pnpm
✅ Node 24
✅ TypeScript NodeNext
✅ CI GitHub Actions
✅ pnpm-lock.yaml présent
✅ Installation en mode --frozen-lockfile
✅ Docker Compose
✅ Caddy
✅ PostgreSQL
✅ Redis
✅ strfry comme relay Nostr
✅ strfry.conf dédié
✅ API Fastify minimale
✅ Worker minimal
✅ Indexer Nostr
✅ Package DB avec Drizzle ORM
✅ Migration bootstrap PostgreSQL
✅ Persistance des événements Nostr dans nostr_events
✅ Table publication_jobs préparée
```

### Structure actuelle

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

## 4. État technique détaillé

### 4.1 Node / TypeScript / pnpm

- Node cible : `>=24.0.0`.
- pnpm cible : `>=9.15.0`.
- TypeScript : NodeNext.
- Le lockfile est obligatoire.
- La CI utilise `pnpm install --frozen-lockfile`.
- Les Dockerfiles utilisent aussi `pnpm install --frozen-lockfile`.

### 4.2 CI GitHub Actions

Workflow principal : `.github/workflows/ci.yml`

Étapes actuellement vérifiées :

```txt
1. Checkout
2. Vérification de présence de pnpm-lock.yaml
3. Setup pnpm
4. Setup Node 24
5. pnpm install --frozen-lockfile
6. pnpm typecheck
7. pnpm build
8. Préparation .env
9. docker compose config
10. docker compose build api worker
```

Workflow lockfile : `.github/workflows/generate-lockfile.yml`

Rôle : générer et committer `pnpm-lock.yaml` quand les dépendances changent.

### 4.3 Docker Compose

Services actuels :

```txt
caddy
postgres
redis
strfry
api
worker
```

Volumes actuels :

```txt
caddy_data
caddy_config
postgres_data
redis_data
strfry_data
```

### 4.4 API

Service : `services/api`

Stack : Fastify.

Endpoints actuels :

```txt
GET /
GET /health
```

Objectif actuel : endpoint de santé et point d’entrée futur de la console/admin API.

### 4.5 Worker

Service : `services/worker`

Rôle actuel :

```txt
1. Démarrer
2. Se connecter à PostgreSQL
3. Lancer la migration bootstrap
4. Démarrer l’indexer Nostr
5. Écouter les événements Nostr
6. Persister les événements reçus dans PostgreSQL
```

### 4.6 Nostr indexer

Kinds actuellement écoutés :

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

Variables utilisées :

```txt
NOSTR_PRIVATE_RELAY
NOSTR_PUBLIC_RELAYS
NOSTR_ALLOWED_PUBKEYS
NOSTR_LOOKBACK_SECONDS
```

### 4.7 Base de données

Package : `packages/db`

Technologie : Drizzle ORM + PostgreSQL.

Tables actuelles :

```txt
nostr_events
publication_jobs
```

#### `nostr_events`

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

#### `publication_jobs`

Rôle : préparer la suite du pipeline publication.

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

---

## 5. Décisions d’architecture prises

### 5.1 Nostr comme source de vérité

RelayPress ne doit pas dépendre d’un back-office propriétaire comme source principale. Les intentions et scénarios doivent pouvoir être exprimés via événements Nostr.

### 5.2 Relay privé strfry

Le projet embarque un relay Nostr via `strfry`, configuré comme brique séparée Docker. Le relay n’est pas la base métier. Il est le journal souverain.

### 5.3 PostgreSQL pour l’état métier

PostgreSQL stocke l’état opérationnel : événements indexés, jobs, statuts, erreurs, résultats.

### 5.4 Drizzle ORM

Drizzle a été choisi pour rester léger, explicite et proche du SQL.

### 5.5 Publication externe uniquement via API officielles

Pas de scraping navigateur. Les publishers X, LinkedIn, Meta, Instagram devront utiliser les APIs officielles.

### 5.6 CI stricte

Le projet doit rester reproductible : `pnpm-lock.yaml` obligatoire, build Docker testé, Node 24 partout.

---

## 6. Phases principales

## Phase 0 — Cadrage conceptuel

### Objectif

Définir la vision : système éditorial souverain piloté par Nostr, IA et publication multi-plateforme.

### Statut

```txt
✅ Terminé
```

### Résultats

- Vision clarifiée.
- Refus du simple crossposter.
- Nostr défini comme plan de contrôle.
- IA définie comme couche d’adaptation sous contrainte.

---

## Phase 1 — Socle dépôt et CI

### Objectif

Créer un dépôt propre, buildable, auditable.

### Statut

```txt
✅ Terminé
```

### Résultats

- Dépôt GitHub créé.
- README initial.
- Licence AGPL-3.0.
- Monorepo pnpm.
- Node 24.
- CI GitHub Actions.
- Lockfile pnpm.
- Dockerfiles API/Worker.

---

## Phase 2 — Infrastructure locale Docker

### Objectif

Préparer une stack locale/staging avec Caddy, PostgreSQL, Redis, strfry, API et Worker.

### Statut

```txt
✅ Terminé pour le socle
⚠️ À valider sur serveur réel
```

### Résultats

- `docker-compose.yml` prêt.
- Caddy configuré.
- PostgreSQL configuré.
- Redis configuré.
- strfry configuré avec `strfry.conf` dédié.

### Reste à valider

- Démarrage réel sur VPS.
- Accès HTTP/HTTPS.
- Proxy WebSocket du relay.
- Persistances volumes.
- Redémarrage après reboot.

---

## Phase 3 — Indexation Nostr

### Objectif

Écouter les événements Nostr et les stocker en base.

### Statut

```txt
✅ Implémenté
⚠️ À valider runtime sur serveur
```

### Résultats

- Indexer Nostr ajouté.
- Relays configurables par `.env`.
- Filtrage par pubkey possible.
- Insertion idempotente des événements dans PostgreSQL.

### Reste à faire

- Tester avec une vraie pubkey.
- Vérifier le nombre d’événements stockés.
- Ajouter métriques simples.
- Ajouter logs plus structurés.

---

## Phase 4 — Génération des jobs de publication

### Objectif

Transformer certains événements Nostr en `publication_jobs`.

### Statut

```txt
⏳ À faire
```

### Règles pressenties

Détecter les tags ou mots-clés :

```txt
#publish
#x
#linkedin
#facebook
#instagram
#noai
#draft
```

### Résultat attendu

```txt
Nostr event → règles → publication_jobs
```

---

## Phase 5 — Policy Engine

### Objectif

Encadrer ce qui peut être publié automatiquement ou non.

### Statut

```txt
⏳ À faire
```

### Règles initiales

Publication automatique possible :

- rappel événement déjà validé ;
- republication simple ;
- contenu sans affirmation sensible.

Validation humaine obligatoire :

- politique ;
- sponsor ;
- chiffres/statistiques ;
- conseil financier ;
- contenu polémique ;
- image générée.

---

## Phase 6 — IA contrôlée

### Objectif

Ajouter une couche IA capable d’adapter ou générer du contenu selon les scénarios.

### Statut

```txt
⏳ À faire
```

### Providers envisagés

- OpenAI ;
- Mistral ;
- Ollama local ;
- autres providers via abstraction.

### Principe

L’IA ne doit pas décider seule de la stratégie. Elle exécute un cadre éditorial signé.

---

## Phase 7 — Publishers externes

### Objectif

Publier vers les plateformes externes via API officielles.

### Statut

```txt
⏳ À faire
```

### Ordre recommandé

```txt
1. Publisher mock
2. LinkedIn
3. X
4. Facebook Page
5. Instagram Business
6. Mastodon / WordPress
```

### Remarque

Le publisher mock doit précéder les publishers réels pour tester le pipeline sans risque de publication publique.

---

## Phase 8 — Console web / admin

### Objectif

Créer une interface pour suivre les scénarios, jobs, brouillons, validations, logs et connexions plateformes.

### Statut

```txt
⏳ À faire
```

### Écrans envisagés

- Dashboard ;
- événements Nostr indexés ;
- publication jobs ;
- brouillons ;
- validations ;
- comptes connectés ;
- paramètres ;
- logs.

---

## Phase 9 — Déploiement staging

### Objectif

Valider le fonctionnement réel sur un VPS.

### Statut

```txt
⏳ Prochaine grande étape recommandée
```

### Tests attendus

```txt
git clone
docker compose up -d --build
docker compose ps
curl /health
logs worker
migration PostgreSQL
insertion d’événements Nostr
query SQL nostr_events
redémarrage serveur
```

---

## Phase 10 — Production durcie

### Objectif

Passer d’un staging fonctionnel à une infrastructure exploitable durablement.

### Statut

```txt
⏳ Plus tard
```

### À prévoir

- sauvegardes PostgreSQL ;
- sauvegardes volumes strfry ;
- monitoring ;
- alertes ;
- rotation logs ;
- durcissement firewall ;
- politique de secrets ;
- nom de domaine définitif ;
- documentation d’exploitation.

---

## 7. Points ouverts

### 7.1 Nom de domaine staging

À décider.

Options possibles :

```txt
relaypress-staging.copinmalin.top
api.relaypress-staging.copinmalin.top
relay.relaypress-staging.copinmalin.top
```

ou :

```txt
relaypress.copinmalin.top
api.relaypress.copinmalin.top
relay.relaypress.copinmalin.top
```

### 7.2 Politique du relay strfry

Actuellement, l’auth est désactivée.

À décider :

- relay privé strict ;
- relay semi-public ;
- écriture limitée à certaines pubkeys ;
- lecture publique ou privée ;
- politique de rétention.

### 7.3 Modèle exact des tags de commande

À stabiliser :

```txt
#publish
#x
#linkedin
#facebook
#instagram
#noai
#draft
#campaign:<name>
#scenario:<name>
```

### 7.4 Choix du premier publisher réel

Recommandation actuelle : commencer par `mock`, puis LinkedIn.

### 7.5 Gestion des secrets

À définir avant serveur public :

- `.env` local ;
- secrets Docker ;
- Vault ou équivalent plus tard ;
- chiffrement des tokens OAuth.

---

## 8. Prochaines actions recommandées

### Action immédiate 1 — Vérifier CI après DB

Vérifier que le dernier run CI est vert après ajout de `packages/db`.

### Action immédiate 2 — Déploiement staging

Mettre en place un serveur de test pour valider :

```txt
Docker Compose
Caddy
API health
strfry
worker
PostgreSQL
insertion nostr_events
```

### Action immédiate 3 — Ajouter génération de publication_jobs

Après validation serveur :

```txt
Nostr event + #publish + #platform → publication_jobs
```

---

## 9. Commandes de validation locale

```bash
cp .env.example .env
./scripts/validate-local.sh
```

Ou étape par étape :

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
docker compose config
docker compose build api worker
```

Runtime local :

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f worker
curl http://localhost:3000/health
```

Vérification PostgreSQL :

```bash
docker compose exec postgres psql -U relaypress -d relaypress
```

```sql
select count(*) from nostr_events;
select id, kind, pubkey, created_at, indexed_at
from nostr_events
order by indexed_at desc
limit 10;
```

---

## 10. Journal de suivi

### Initialisation projet

- Création du dépôt `Copinmalin/relaypress`.
- Choix AGPL-3.0.
- Création README et documentation initiale.
- Mise en place pnpm workspace.

### Stabilisation CI

- Correction lockfile.
- Passage Node 24.
- Mise à jour actions GitHub vers versions compatibles Node 24.
- Ajout du build Docker dans la CI.

### Infrastructure Docker

- Ajout Caddy.
- Ajout PostgreSQL.
- Ajout Redis.
- Ajout strfry.
- Ajout `strfry.conf` dédié.

### Indexation Nostr

- Ajout `nostr-tools`.
- Ajout indexer.
- Correction imports ESM NodeNext.
- Correction typage `Filter`.

### Base de données

- Ajout `packages/db`.
- Ajout Drizzle ORM.
- Ajout tables `nostr_events` et `publication_jobs`.
- Ajout migration bootstrap.
- Connexion du worker à PostgreSQL.
- Persistance des events Nostr.

---

## 11. Notes de prudence

Le projet n’est pas encore prêt pour production.

Ce qui est prêt :

```txt
socle technique
CI
Docker build
modèle DB initial
indexation persistée
```

Ce qui n’est pas encore prêt :

```txt
sécurité production
OAuth plateformes
IA
policy engine
publishers
console web
monitoring
sauvegardes
```

La prochaine bascule structurante est le déploiement staging.

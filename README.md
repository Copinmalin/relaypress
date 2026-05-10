# RelayPress

**RelayPress** est un système d’orchestration éditoriale souverain piloté par Nostr.

L’objectif n’est pas de faire un simple crossposter. RelayPress sépare l’intention éditoriale signée, l’état métier opérationnel, l’adaptation par plateforme, la validation humaine, la publication et l’audit d’exécution.

## État actuel

Le dépôt contient aujourd’hui un MVP éditorial fonctionnel en staging :

- monorepo pnpm avec Node 24 et TypeScript NodeNext ;
- CI GitHub Actions avec `pnpm-lock.yaml` obligatoire ;
- stack Docker Compose : Caddy, PostgreSQL, Redis, strfry, API et worker ;
- relay Nostr privé via strfry ;
- indexation Nostr filtrée par pubkey autorisée ;
- création de jobs éditoriaux depuis Nostr ou depuis l’interface admin ;
- conservation séparée de `sourceContent` et `adaptedContent` ;
- adaptation déterministe par plateforme, dont LinkedIn sans IA ;
- interface admin pour créer, lire, éditer, réadapter, valider, rejeter, relancer et archiver ;
- publisher mock isolé derrière une interface commune ;
- historique d’exécution dans `publication_job_runs` ;
- stub LinkedIn réel préparé, non activé par défaut.

Le mode de publication réel reste volontairement désactivé. `PUBLISHER_MODE=mock` est la configuration sûre par défaut.

## Vision

```txt
Nostr = intention signée + journal souverain + plan de contrôle
Relay privé = registre canonique des événements éditoriaux
PostgreSQL = état métier opérationnel
Worker = moteur d’indexation, de transformation et de publication
API admin = pilotage éditorial humain
Publishers = sorties vers plateformes externes
IA = adaptation sous contraintes, plus tard
```

## Workflow MVP

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

## Principes non négociables

- Nostr reste la racine souveraine des intentions éditoriales.
- PostgreSQL porte l’état métier opérationnel.
- Aucun `nsec` ne doit être stocké en clair.
- Les tokens OAuth devront être chiffrés avant tout branchement réel.
- Pas de scraping de réseaux sociaux.
- Publication externe uniquement via API officielles.
- Les contenus sensibles doivent rester soumis à validation humaine.
- Les actions importantes doivent être auditables.
- Le mode `mock` reste le mode par défaut tant que LinkedIn réel n’est pas durci.

## Structure du dépôt

```txt
.
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── 00-agent-task.yml
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── generate-lockfile.yml
│   └── pull_request_template.md
├── AGENTS.md                # Instructions pour agents IA
├── docs/                    # Vision, architecture, sécurité, roadmap, suivi maître
├── infra/                   # Caddy et configuration strfry
├── packages/db/             # Initialisation et accès PostgreSQL
├── packages/shared/         # Types et constantes partagés
├── services/api/            # API Fastify + interface admin + assets admin
├── services/worker/         # Indexer Nostr + orchestrateur publisher
├── scripts/                 # Validation locale
├── docker-compose.yml       # Stack locale / staging
├── .env.example             # Variables d’environnement documentées
└── pnpm-lock.yaml           # Lockfile obligatoire
```

## Travail avec agents IA

RelayPress contient maintenant une base minimale pour travailler proprement avec Codex, GitHub Copilot ou un autre agent IA :

- `AGENTS.md` : règles de travail, contraintes de sécurité, source de vérité et Definition of Done ;
- `.github/ISSUE_TEMPLATE/00-agent-task.yml` : formulaire d’issue pour créer des tâches agentiques limitées, vérifiables et reliées au projet ;
- `.github/pull_request_template.md` : template de Pull Request pour cadrer le scope, les vérifications, les risques et la revue humaine.

Règle opérationnelle :

```txt
Une issue = une tâche = une PR possible.
```

Avant toute modification structurante, relire :

```txt
AGENTS.md
docs/MASTER_PROJECT_TRACKING.md
```

## Démarrage local

```bash
cp .env.example .env
pnpm install
pnpm check
```

Avec Docker :

```bash
docker compose up -d --build
```

## Déploiement staging

```bash
cd /opt/relaypress
git pull
docker compose up -d --build

export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"
echo "Token length: ${#ADMIN_API_TOKEN}"
```

## Documentation de référence

Le fichier `docs/MASTER_PROJECT_TRACKING.md` est la source de vérité opérationnelle du projet. Les autres documents doivent rester cohérents avec lui.

## Licence

Ce projet est placé sous licence **AGPL-3.0-or-later**.

Cette licence est volontairement protectrice pour un projet serveur : si RelayPress est modifié et exploité comme service réseau, les améliorations doivent rester accessibles à la communauté.

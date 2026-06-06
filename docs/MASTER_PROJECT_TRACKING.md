# RelayPress — Master Project Tracking

Ce document est la **source de vérité opérationnelle synthétique** du projet RelayPress.

Il ne contient pas les détails longs d’architecture, de déploiement, de sécurité ou de roadmap. Ces informations vivent dans les documents spécialisés listés plus bas.

Dernière mise à jour : 2026-06-06

État global : **MVP éditorial souverain fonctionnel en staging, backlog nettoyé, trajectoire produit recentrée sur sources → Signal Engine → campagnes → IA → validation → publication multi-canal. PR B a introduit les `editorial_signals` rattachés aux `source_items`. PR C prépare l’API de qualification humaine source → signal. Publishers réels non activés par défaut.**

---

## 1. Résumé exécutif

RelayPress est une application d’orchestration éditoriale souveraine.

Son rôle est de transformer des sources d’information sélectionnées en contenus prêts à publier sur plusieurs canaux, avec génération assistée par IA, validation humaine, publication contrôlée et audit.

RelayPress n’est pas un simple crossposter. Le cœur du système est la séparation nette entre :

```text
Sources éditoriales = matière première récupérée ou sélectionnée
Signal Engine = qualification, contextualisation et préparation de campagnes
Nostr = intention signée + journal souverain
PostgreSQL = état métier opérationnel
API admin = pilotage humain
IA = génération et adaptation contrôlées
Worker = récupération, orchestration publisher et tâches asynchrones
Publishers = sorties externes contrôlées
```

---

## 2. Principes non négociables

- Nostr reste une racine souveraine des intentions éditoriales et du journal de publication.
- PostgreSQL porte l’état métier opérationnel.
- Aucun `nsec` ne doit être stocké en clair.
- Les tokens OAuth doivent être chiffrés avant tout branchement réel durable.
- Pas de scraping de réseaux sociaux.
- Publication externe uniquement via API officielles.
- L’IA propose, l’humain valide, le publisher exécute.
- Les contenus sensibles restent soumis à validation humaine.
- Les actions importantes doivent être auditables.
- Un job déjà publié ne doit jamais être republié accidentellement.
- L’archivage ne doit jamais supprimer l’historique.
- `pnpm-lock.yaml` est obligatoire.
- Node 24 est la cible runtime et CI.
- Docker Compose reste la base de reproductibilité staging.
- `PUBLISHER_MODE=mock` reste le défaut sûr tant que les publishers réels ne sont pas durcis.
- Telegram est hors scope comme canal de diffusion RelayPress et ne doit pas devenir une dépendance technique prioritaire.
- BTC Breakdown sert de radar initial, pas de contenu à republier tel quel.

---

## 3. État courant du projet

| Élément | État |
|---|---|
| Dépôt | `Copinmalin/relaypress` |
| Branche principale | `main` |
| Branche PR en cours | `pr-c-source-signal-api` |
| Runtime | Node 24 |
| Monorepo | pnpm |
| Staging | déployé |
| API | Fastify |
| Base métier | PostgreSQL |
| Cache / queue futur | Redis |
| Relay Nostr privé | strfry |
| Reverse proxy | Caddy |
| Publisher actif par défaut | mock |
| Publisher LinkedIn réel | préparé, à finaliser en premier |
| Interface admin | fonctionnelle pour jobs, publishers et sources récupérées |
| Sources automatisées | ingestion minimale BTC Breakdown + admin `source_items` implémentés |
| Signaux éditoriaux | modèle DB et types partagés introduits ; API de qualification en PR C |
| Signal Engine | cadré dans `docs/08_SIGNAL_ENGINE.md`, à implémenter par PR atomiques |
| Génération IA | à implémenter sous validation humaine |
| Documentation | rationalisée autour du master synthétique et des docs spécialisées |
| Workflow agent IA | actif, via issue atomique, PR dédiée et revue humaine |
| Backlog GitHub | nettoyé au 2026-05-25 |

---

## 4. Architecture logique synthétique cible

```text
Source éditoriale récupérée ou brouillon manuel
→ SourceItem stocké si source récupérée
→ sélection humaine dans l'admin sources
→ EditorialSignal qualifié
→ campagne éditoriale
→ publication_jobs par plateforme
→ adapted_content généré par IA ou édité humainement
→ validation humaine
→ worker
→ publisher mock ou réel
→ publication_job_runs
→ archivage non destructif
```

Composants principaux :

```text
services/api      = API Fastify + interface admin
services/worker   = récupération des sources, indexer Nostr, orchestration publisher
packages/db       = initialisation et accès PostgreSQL
packages/shared   = types et constantes partagés
infra/            = configuration d’infrastructure
```

Détails : voir `docs/01_ARCHITECTURE.md`, `docs/08_SIGNAL_ENGINE.md`, `docs/09_PHASE_A_SOURCE_ITEMS.md`, `docs/10_PHASE_A2_BTCBREAKDOWN_INGESTION.md`, `docs/11_PHASE_A3_ADMIN_SOURCES.md`, `docs/12_PR_B_EDITORIAL_SIGNALS.md` et `docs/13_PR_C_SOURCE_SIGNAL_API.md`.

---

## 5. Statuts métier actifs

```text
pending         = job créé automatiquement, en attente de traitement éditorial
pending_review  = brouillon manuel ou contenu à relire
approved        = validé humainement, prêt pour le worker
publishing      = publication en cours
published       = publié ou simulé via mock publisher
rejected        = refusé, à retravailler ou archiver
failed          = tentative échouée, à corriger ou retenter
archived        = conservé pour audit, masqué des vues actives
```

Transitions sensibles :

- `retry` uniquement depuis `failed` ;
- `reset-review` uniquement depuis `rejected` ou `failed` ;
- `archive` interdit depuis `publishing` ;
- aucun job déjà publié ne doit repasser en publication.

Les statuts de `SourceItem` introduits en Phase A sont :

```text
new
selected
ignored
archived
failed
```

Ils ne déclenchent aucune publication. L'admin Phase A3 permet uniquement les transitions humaines vers `selected`, `ignored` ou `archived`.

Les statuts de `EditorialSignal` introduits en PR B sont :

```text
qualified
needs_sources
ready_for_campaign
ignored
archived
```

Ils ne déclenchent aucune campagne ni publication automatique.

---

## 6. Sources de vérité spécialisées

| Document | Rôle |
|---|---|
| `AGENTS.md` | règles de travail pour agents IA dans ce dépôt |
| `.github/ISSUE_TEMPLATE/00-agent-task.yml` | Issue Form GitHub pour créer une tâche agent IA atomique |
| `.github/pull_request_template.md` | template GitHub pour cadrer les Pull Requests |
| `docs/DOCUMENTATION_AUDIT.md` | audit documentaire et plan de refactor historique |
| `docs/00_PROJECT_VISION.md` | vision, doctrine, positionnement |
| `docs/01_ARCHITECTURE.md` | architecture logique et composants |
| `docs/02_NOSTR_EVENT_MODEL.md` | modèle d’événements Nostr |
| `docs/03_SECURITY_MODEL.md` | sécurité, secrets, OAuth, logs, publication réelle |
| `docs/04_DEPLOYMENT_CADDY_DOCKER.md` | déploiement staging, Docker, Caddy, exploitation |
| `docs/05_ROADMAP.md` | roadmap et prochaines étapes produit |
| `docs/06_CI_NOTES.md` | CI, Node, pnpm, lockfile, Docker checks |
| `docs/07_AGENT_WORKFLOW.md` | workflow Codex, Copilot et agents IA |
| `docs/08_SIGNAL_ENGINE.md` | cadrage du Signal Engine : BTC Breakdown, signaux, canaux, contraintes et roadmap |
| `docs/09_PHASE_A_SOURCE_ITEMS.md` | cadrage Phase A : modèle `SourceItem`, source_items, statuts et garde-fous |
| `docs/10_PHASE_A2_BTCBREAKDOWN_INGESTION.md` | implémentation ingestion minimale BTC Breakdown vers `source_items` |
| `docs/11_PHASE_A3_ADMIN_SOURCES.md` | implémentation admin des sources récupérées |
| `docs/12_PR_B_EDITORIAL_SIGNALS.md` | implémentation `EditorialSignal` et rattachement `source_items` |
| `docs/13_PR_C_SOURCE_SIGNAL_API.md` | implémentation API de qualification source sélectionnée → signal éditorial |
| `docs/PHASE_F_PUBLISHER_ACCOUNTS.md` | comptes publishers, OAuth admin et chiffrement |
| `docs/LINKEDIN_REAL_TEST_RUNBOOK.md` | test LinkedIn réel contrôlé |

Règle : le master pointe vers les détails. Les documents spécialisés portent les détails.

---

## 7. Phase actuelle et prochaines priorités

### Phase actuelle

```text
PR C — Source Signal API : ajouter une qualification humaine source sélectionnée → EditorialSignal.
```

### Priorités courantes

1. Ouvrir une Pull Request depuis `pr-c-source-signal-api` vers `main`.
2. Laisser tourner le check obligatoire `RelayPress checks`.
3. Corriger les éventuels retours CI.
4. Après merge, préparer la création explicite de jobs depuis source ou signal avec sélection des plateformes.
5. Ajouter la génération IA contrôlée par plateforme.
6. Ajouter la vue admin groupée par source / signal / campagne.
7. Finaliser LinkedIn réel en premier, sous test contrôlé et retour mock obligatoire.

### Backlog immédiat cible

```text
PR A1 — Schéma SourceItem : implémenté
PR A2 — Ingestion BTC Breakdown minimale : implémenté
PR A3 — Admin sources récupérées : implémenté
PR B — Signal éditorial qualifié et rattachement source : implémenté
PR C — API de qualification source sélectionnée → signal : en cours
PR D — Jobs depuis source ou signal avec source_item_id
PR E — Génération IA contrôlée
PR F — Vue admin groupée par source / signal / campagne
PR G — Finaliser LinkedIn réel contrôlé
```

---

## 8. Décisions structurantes récentes

| Date | Décision |
|---|---|
| 2026-05-05 | Le publisher mock reste le défaut sûr. |
| 2026-05-05 | Le publisher LinkedIn réel reste préparé mais non activé par défaut. |
| 2026-05-10 | RelayPress adopte un workflow agent IA : issue atomique, PR dédiée, revue humaine. |
| 2026-05-11 | `DOCUMENTATION_AUDIT.md` devient la base du refactor documentaire. |
| 2026-05-11 | `MASTER_PROJECT_TRACKING.md` est réduit en document cœur synthétique. |
| 2026-05-11 | `AGENTS.md`, l’Issue Form agent IA et le template PR sont référencés comme sources structurantes. |
| 2026-05-25 | Backlog GitHub nettoyé avant la nouvelle trajectoire produit. |
| 2026-05-25 | Trajectoire validée : BTC Breakdown → sélection humaine → IA → jobs par plateforme → validation → publication contrôlée. |
| 2026-05-25 | `publication_jobs` reste le cœur opérationnel ; rattachement source prévu via `source_item_id`. |
| 2026-05-25 | LinkedIn réel sera finalisé avant Nostr, Blog, Facebook et Instagram. |
| 2026-06-05 | Signal Engine validé comme cadrage produit : BTC Breakdown comme radar initial, Telegram hors scope diffusion, canaux cibles Blog/Nostr/LinkedIn/X/Facebook/Instagram. |
| 2026-06-06 | Phase A1 implémentée : table `source_items`, migration idempotente et types partagés `SourceItem`. Aucune ingestion réelle, IA ou publication ajoutée. |
| 2026-06-06 | Phase A2 implémentée : ingestion minimale BTC Breakdown vers `source_items`, sans IA, campagne, job de publication ni Telegram. |
| 2026-06-06 | Phase A3 implémentée : API et page admin `/admin/sources` pour afficher, filtrer, sélectionner, ignorer ou archiver les `source_items`, sans création de publication. |
| 2026-06-06 | PR B fusionnée : `editorial_signals` rattachés aux `source_items`, sans IA, campagne ni publication automatique. |
| 2026-06-06 | PR C lancée : qualification humaine d’une source `selected` en `EditorialSignal`, sans IA ni publication. |

---

## 9. Risques actifs et points de vigilance

| Risque | Statut | Document de référence |
|---|---|---|
| Publication réelle accidentelle | contrôlé par défaut mock | `docs/03_SECURITY_MODEL.md` |
| Exposition de secret OAuth ou admin | à surveiller | `docs/03_SECURITY_MODEL.md` |
| Génération IA publiée sans validation | interdit par doctrine | `docs/05_ROADMAP.md` |
| Import source trop large ou instable | commencer par BTC Breakdown uniquement | `docs/05_ROADMAP.md`, `docs/08_SIGNAL_ENGINE.md`, `docs/09_PHASE_A_SOURCE_ITEMS.md`, `docs/10_PHASE_A2_BTCBREAKDOWN_INGESTION.md`, `docs/11_PHASE_A3_ADMIN_SOURCES.md` |
| Recopie excessive de contenus tiers | BTC Breakdown = radar, analyse originale obligatoire | `docs/08_SIGNAL_ENGINE.md`, `docs/09_PHASE_A_SOURCE_ITEMS.md`, `docs/10_PHASE_A2_BTCBREAKDOWN_INGESTION.md` |
| Signal transformé en publication automatique | explicitement hors scope PR B et PR C | `docs/12_PR_B_EDITORIAL_SIGNALS.md`, `docs/13_PR_C_SOURCE_SIGNAL_API.md` |
| Telegram transformé en dépendance technique | hors scope diffusion et ingestion automatique initiale | `docs/08_SIGNAL_ENGINE.md`, `docs/09_PHASE_A_SOURCE_ITEMS.md` |
| Divergence documentaire | réduit par master synthétique | `docs/DOCUMENTATION_AUDIT.md` |
| CI ou lockfile incohérent | à vérifier à chaque PR | `docs/06_CI_NOTES.md` |
| Runbook LinkedIn réel incomplet | à consolider avant test réel | `docs/LINKEDIN_REAL_TEST_RUNBOOK.md` |
| Sauvegardes et monitoring production | non finalisés | `docs/05_ROADMAP.md` |

---

## 10. Règles de mise à jour documentaire

- Une décision structurante doit être mentionnée ici.
- Une information détaillée doit vivre dans le document spécialisé approprié.
- Une commande longue ne doit pas vivre dans ce master.
- Un runbook ne doit pas vivre dans ce master.
- Une phase détaillée doit vivre dans `docs/05_ROADMAP.md` ou un document de phase dédié.
- Un changement d’architecture doit mettre à jour `docs/01_ARCHITECTURE.md` et ce master si l’état courant change.
- Un changement de sécurité doit mettre à jour `docs/03_SECURITY_MODEL.md` et ce master si un risque actif change.
- Toute PR documentaire doit indiquer quel document fait autorité.
- Toute tâche agent IA doit partir de `AGENTS.md`, d’une issue atomique et d’une PR dédiée.

---

## 11. Prochaine action recommandée

```text
Ouvrir une Pull Request `pr-c-source-signal-api` → `main`, puis laisser tourner `RelayPress checks` avant merge.
```

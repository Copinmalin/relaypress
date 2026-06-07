# RelayPress — Master Project Tracking

Ce document est la **source de vérité opérationnelle synthétique** du projet RelayPress.

Dernière mise à jour : 2026-06-07

État global : **MVP éditorial souverain fonctionnel en staging. La trajectoire produit est recentrée sur sources → signaux éditoriaux → préparation explicite de jobs → IA contrôlée → validation → publication multi-canal. PR E ajoute la préparation de `publication_jobs` depuis un `EditorialSignal ready_for_campaign`, avec sélection humaine des plateformes, sans IA et sans publication automatique.**

---

## 1. Résumé exécutif

RelayPress est une application d’orchestration éditoriale souveraine.

Le cœur du système est la séparation nette entre :

```text
SourceItem = source récupérée et auditée
EditorialSignal = lecture éditoriale humaine d’une source
PublicationJob = brouillon opérationnel par plateforme, toujours validable humainement
Nostr = intention signée + journal souverain
PostgreSQL = état métier opérationnel
API admin = pilotage humain
IA = génération et adaptation contrôlées
Worker = orchestration publisher et tâches asynchrones
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
- `PUBLISHER_MODE=mock` reste le défaut sûr tant que les publishers réels ne sont pas durcis.
- Telegram est hors scope comme canal de diffusion RelayPress et ne doit pas devenir une dépendance technique prioritaire.
- BTC Breakdown sert de radar initial, pas de contenu à republier tel quel.

---

## 3. État courant du projet

| Élément | État |
|---|---|
| Dépôt | `Copinmalin/relaypress` |
| Branche principale | `main` |
| Branche PR en cours | `pr-e-jobs-from-signal` |
| Runtime | Node 24 |
| Monorepo | pnpm |
| API | Fastify |
| Base métier | PostgreSQL |
| Publisher actif par défaut | mock |
| Interface admin | jobs, publishers, sources récupérées, signaux éditoriaux |
| Sources automatisées | ingestion minimale BTC Breakdown + admin `source_items` implémentés |
| Signaux éditoriaux | modèle DB, qualification API et admin de tri implémentés |
| Jobs depuis signaux | en PR E, création explicite depuis un signal `ready_for_campaign` |
| Génération IA | à implémenter sous validation humaine |

---

## 4. Architecture logique synthétique cible

```text
Source éditoriale récupérée ou brouillon manuel
→ SourceItem stocké si source récupérée
→ sélection humaine dans l’admin sources
→ EditorialSignal qualifié
→ tri humain du signal dans l’admin
→ préparation explicite de publication_jobs par plateforme
→ génération IA future ou édition humaine
→ validation humaine
→ worker
→ publisher mock ou réel
→ publication_job_runs
→ archivage non destructif
```

---

## 5. Statuts métier actifs

### SourceItem

```text
new
selected
ignored
archived
failed
```

Ces statuts ne déclenchent aucune publication.

### EditorialSignal

```text
qualified
needs_sources
ready_for_campaign
ignored
archived
```

### PublicationJob

```text
pending
pending_review
drafted
approved
publishing
published
rejected
failed
archived
```

PR E permet uniquement de créer des jobs depuis un signal `ready_for_campaign` avec statut initial :

```text
pending_review
drafted
```

Cette action ne déclenche aucune IA, aucun passage en `approved` et aucune publication.

---

## 6. Sources de vérité spécialisées

| Document | Rôle |
|---|---|
| `AGENTS.md` | règles de travail pour agents IA dans ce dépôt |
| `docs/08_SIGNAL_ENGINE.md` | cadrage du Signal Engine |
| `docs/09_PHASE_A_SOURCE_ITEMS.md` | modèle `SourceItem`, statuts et garde-fous |
| `docs/10_PHASE_A2_BTCBREAKDOWN_INGESTION.md` | ingestion minimale BTC Breakdown |
| `docs/11_PHASE_A3_ADMIN_SOURCES.md` | admin des sources récupérées |
| `docs/12_PR_B_EDITORIAL_SIGNALS.md` | modèle `EditorialSignal` |
| `docs/13_PR_C_SOURCE_SIGNAL_API.md` | API source sélectionnée vers signal éditorial |
| `docs/14_PR_D_ADMIN_EDITORIAL_SIGNALS.md` | admin des signaux éditoriaux |
| `docs/15_PR_E_JOBS_FROM_SIGNAL.md` | création explicite de jobs depuis signaux prêts |
| `docs/03_SECURITY_MODEL.md` | sécurité, secrets, OAuth, logs, publication réelle |
| `docs/06_CI_NOTES.md` | CI, Node, pnpm, lockfile, Docker checks |

---

## 7. Phase actuelle et prochaines priorités

```text
PR E — Jobs depuis signal ready_for_campaign : endpoint explicite, plateformes humaines, jobs en pending_review ou drafted.
```

Backlog immédiat :

```text
PR A1 — Schéma SourceItem : implémenté
PR A2 — Ingestion BTC Breakdown minimale : implémenté
PR A3 — Admin sources récupérées : implémenté
PR B — Signal éditorial qualifié et rattachement source : implémenté
PR C — API de qualification source sélectionnée vers signal : implémenté
PR D — Admin signaux éditoriaux : implémenté
PR E — Jobs depuis signal avec sélection de plateformes : en cours
PR F — Génération IA contrôlée
PR G — Vue admin groupée par source / signal / campagne
PR H — Finaliser LinkedIn réel contrôlé
```

---

## 8. Décisions structurantes récentes

| Date | Décision |
|---|---|
| 2026-05-25 | Trajectoire validée : BTC Breakdown → sélection humaine → IA → jobs par plateforme → validation → publication contrôlée. |
| 2026-06-05 | Signal Engine validé : BTC Breakdown comme radar initial, Telegram hors scope diffusion. |
| 2026-06-06 | Phase A1/A2/A3 implémentées : `source_items`, ingestion BTC Breakdown et admin sources. |
| 2026-06-06 | PR B fusionnée : modèle `editorial_signals`. |
| 2026-06-06 | PR C fusionnée : qualification humaine d’une source `selected` en `EditorialSignal`. |
| 2026-06-07 | PR D fusionnée : admin des signaux éditoriaux, filtres et actions `ready_for_campaign`, `ignored`, `archived`. |
| 2026-06-07 | PR E lancée : création explicite de jobs depuis signal `ready_for_campaign`, avec sélection humaine des plateformes. |

---

## 9. Risques actifs et points de vigilance

| Risque | Statut | Document de référence |
|---|---|---|
| Publication réelle accidentelle | contrôlé par défaut mock | `docs/03_SECURITY_MODEL.md` |
| Génération IA publiée sans validation | interdit par doctrine | `docs/05_ROADMAP.md` |
| Signal transformé en publication automatique | hors scope PR B, PR C, PR D et PR E | `docs/12_PR_B_EDITORIAL_SIGNALS.md`, `docs/13_PR_C_SOURCE_SIGNAL_API.md`, `docs/14_PR_D_ADMIN_EDITORIAL_SIGNALS.md`, `docs/15_PR_E_JOBS_FROM_SIGNAL.md` |
| Telegram transformé en dépendance technique | hors scope initial | `docs/08_SIGNAL_ENGINE.md`, `docs/09_PHASE_A_SOURCE_ITEMS.md` |
| CI ou lockfile incohérent | à vérifier à chaque PR | `docs/06_CI_NOTES.md` |

---

## 10. Prochaine action recommandée

```text
Ouvrir une Pull Request `pr-e-jobs-from-signal` vers `main`, puis laisser tourner `RelayPress checks` avant merge.
```

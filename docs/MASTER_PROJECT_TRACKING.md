# RelayPress — Master Project Tracking

Ce document est la **source de vérité opérationnelle synthétique** du projet RelayPress.

Il ne contient plus les détails d’architecture, de déploiement, de sécurité ou de roadmap. Ces informations vivent dans les documents spécialisés listés plus bas.

Dernière mise à jour : 2026-05-11

État global : **MVP éditorial souverain fonctionnel en staging, documentation en cours de rationalisation, publishers réels non activés par défaut.**

---

## 1. Résumé exécutif

RelayPress est un système d’orchestration éditoriale souverain piloté par Nostr.

Son rôle est de transformer une intention éditoriale signée ou un brouillon manuel en jobs de publication contrôlés, adaptés par plateforme, validés humainement, publiés via un publisher et audités dans le temps.

RelayPress n’est pas un simple crossposter. Le cœur du système est la séparation nette entre :

```text
Nostr = intention signée + journal souverain
PostgreSQL = état métier opérationnel
API admin = pilotage humain
Worker = indexation, adaptation, orchestration publisher
Publishers = sorties externes contrôlées
```

---

## 2. Principes non négociables

- Nostr reste la racine souveraine des intentions éditoriales.
- PostgreSQL porte l’état métier opérationnel.
- Aucun `nsec` ne doit être stocké en clair.
- Les tokens OAuth doivent être chiffrés avant tout branchement réel durable.
- Pas de scraping de réseaux sociaux.
- Publication externe uniquement via API officielles.
- Les contenus sensibles restent soumis à validation humaine.
- Les actions importantes doivent être auditables.
- Un job déjà publié ne doit jamais être republié accidentellement.
- L’archivage ne doit jamais supprimer l’historique.
- `pnpm-lock.yaml` est obligatoire.
- Node 24 est la cible runtime et CI.
- Docker Compose reste la base de reproductibilité staging.
- `PUBLISHER_MODE=mock` reste le défaut sûr tant que les publishers réels ne sont pas durcis.

---

## 3. État courant du projet

| Élément | État |
|---|---|
| Dépôt | `Copinmalin/relaypress` |
| Branche principale | `main` |
| Runtime | Node 24 |
| Monorepo | pnpm |
| Staging | déployé |
| API | Fastify |
| Base métier | PostgreSQL |
| Cache / queue futur | Redis |
| Relay Nostr privé | strfry |
| Reverse proxy | Caddy |
| Publisher actif par défaut | mock |
| Publisher LinkedIn réel | préparé, non activé par défaut |
| Interface admin | fonctionnelle pour MVP |
| Documentation | refactor en cours |

---

## 4. Architecture logique synthétique

```text
Nostr event ou brouillon manuel
→ publication_jobs
→ source_content conservé
→ adapted_content généré ou édité
→ validation humaine
→ worker
→ publisher mock ou réel
→ publication_job_runs
→ archivage non destructif
```

Composants principaux :

```text
services/api      = API Fastify + interface admin
services/worker   = indexer Nostr + orchestration publisher
packages/db       = initialisation et accès PostgreSQL
packages/shared   = types et constantes partagés
infra/            = Caddy + strfry
```

Détails : voir `docs/01_ARCHITECTURE.md`.

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

---

## 6. Sources de vérité spécialisées

| Document | Rôle |
|---|---|
| `docs/DOCUMENTATION_AUDIT.md` | audit documentaire et plan de refactor |
| `docs/00_PROJECT_VISION.md` | vision, doctrine, positionnement |
| `docs/01_ARCHITECTURE.md` | architecture logique et composants |
| `docs/02_NOSTR_EVENT_MODEL.md` | modèle d’événements Nostr |
| `docs/03_SECURITY_MODEL.md` | sécurité, secrets, OAuth, logs, publication réelle |
| `docs/04_DEPLOYMENT_CADDY_DOCKER.md` | déploiement staging, Docker, Caddy, exploitation |
| `docs/05_ROADMAP.md` | roadmap et phases projet |
| `docs/06_CI_NOTES.md` | CI, Node, pnpm, lockfile, Docker checks |
| `docs/07_AGENT_WORKFLOW.md` | workflow Codex, Copilot et agents IA |
| `docs/PHASE_F_PUBLISHER_ACCOUNTS.md` | Phase F, comptes publishers, OAuth admin |
| `docs/LINKEDIN_REAL_TEST_RUNBOOK.md` | test LinkedIn réel contrôlé |

Règle : le master pointe vers les détails. Les documents spécialisés portent les détails.

---

## 7. Phase actuelle et prochaines priorités

### Phase actuelle

```text
Phase F — Comptes publishers, OAuth admin et préparation des publishers réels
```

### Priorités courantes

1. Finaliser la rationalisation documentaire.
2. Valider l’admin publishers en staging.
3. Valider le flux OAuth LinkedIn admin sans exposition de secret.
4. Garder `PUBLISHER_MODE=mock` par défaut.
5. Préparer le test LinkedIn réel contrôlé uniquement après validation humaine explicite.

### Issues actives liées

```text
#3  Synchroniser MASTER_PROJECT_TRACKING avec le workflow agent IA
#14 Auditer et refactoriser la documentation RelayPress
#16 Réduire MASTER_PROJECT_TRACKING en document cœur
```

---

## 8. Décisions structurantes récentes

| Date | Décision |
|---|---|
| 2026-05-05 | Le publisher mock reste le défaut sûr. |
| 2026-05-05 | Le publisher LinkedIn réel reste préparé mais non activé par défaut. |
| 2026-05-10 | RelayPress adopte un workflow agent IA : issue atomique, PR dédiée, revue humaine. |
| 2026-05-11 | `DOCUMENTATION_AUDIT.md` devient la base du refactor documentaire. |
| 2026-05-11 | `MASTER_PROJECT_TRACKING.md` doit être réduit en document cœur synthétique. |

---

## 9. Risques actifs et points de vigilance

| Risque | Statut | Document de référence |
|---|---|---|
| Publication réelle accidentelle | contrôlé par défaut mock | `docs/03_SECURITY_MODEL.md` |
| Exposition de secret OAuth ou admin | à surveiller | `docs/03_SECURITY_MODEL.md` |
| Divergence documentaire | refactor en cours | `docs/DOCUMENTATION_AUDIT.md` |
| CI ou lockfile incohérent | à vérifier régulièrement | `docs/06_CI_NOTES.md` |
| Runbook LinkedIn réel incomplet | à utiliser uniquement en test contrôlé | `docs/LINKEDIN_REAL_TEST_RUNBOOK.md` |
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

---

## 11. Prochaine action recommandée

Après validation de cette version cœur :

```text
Poursuivre les issues atomiques Phase F : admin publishers, OAuth LinkedIn, check-connection, sécurité des logs et runbook de test réel.
```

# RelayPress — Audit documentaire

Date : 2026-05-11

Issue liée : `#14 — Auditer et refactoriser la documentation RelayPress`

## 1. Objectif

Ce document formalise l’audit documentaire de RelayPress.

Objectif : clarifier le rôle de chaque fichier `docs/`, identifier les doublons, proposer une structure cible et préparer le refactor de `docs/MASTER_PROJECT_TRACKING.md` sans modification destructive.

Ce document ne modifie pas la source de vérité actuelle. Il prépare la décision.

---

## 2. Sources lues

Sources relues en lecture seule :

```text
AGENTS.md
README.md
docs/MASTER_PROJECT_TRACKING.md
docs/00_PROJECT_VISION.md
docs/01_ARCHITECTURE.md
docs/02_NOSTR_EVENT_MODEL.md
docs/03_SECURITY_MODEL.md
docs/04_DEPLOYMENT_CADDY_DOCKER.md
docs/05_ROADMAP.md
docs/06_CI_NOTES.md
docs/07_AGENT_WORKFLOW.md
docs/PHASE_F_PUBLISHER_ACCOUNTS.md
docs/LINKEDIN_REAL_TEST_RUNBOOK.md
```

Constat : la documentation spécialisée existe déjà. Le problème principal n’est pas l’absence de documents, mais la répartition des responsabilités entre le master et les documents dédiés.

---

## 3. Diagnostic principal

`docs/MASTER_PROJECT_TRACKING.md` cumule aujourd’hui trop de rôles :

```text
source de vérité opérationnelle
vision projet
architecture
infrastructure staging
variables d’environnement
API
interface admin
modèle de données
statuts métier
Nostr indexer
adaptateurs de contenu
publishers
sécurité
phases projet
commandes d’exploitation
roadmap
runbook partiel
journal historique
```

Conséquences :

- document trop long ;
- manipulation risquée par agent IA ;
- forte probabilité de duplication avec les docs spécialisées ;
- difficulté à savoir où mettre à jour une information ;
- risque de divergence entre master et documents spécialisés ;
- PR documentaires plus lourdes que nécessaire.

Décision recommandée : `MASTER_PROJECT_TRACKING.md` doit rester la source de vérité opérationnelle, mais redevenir court, stable et décisionnel.

---

## 4. Rôle cible de chaque fichier

| Fichier | Rôle cible | Commentaire |
|---|---|---|
| `docs/MASTER_PROJECT_TRACKING.md` | Cœur décisionnel et état courant | Source de vérité synthétique, pas encyclopédie |
| `docs/00_PROJECT_VISION.md` | Vision, doctrine, positionnement | Vision détaillée et durable |
| `docs/01_ARCHITECTURE.md` | Architecture logique et composants | API, worker, PostgreSQL, Redis, Nostr, publishers |
| `docs/02_NOSTR_EVENT_MODEL.md` | Modèle d’événements Nostr | Kinds standards, kinds applicatifs, doctrine Nostr |
| `docs/03_SECURITY_MODEL.md` | Sécurité | Secrets, OAuth, logs, publication réelle, durcissements |
| `docs/04_DEPLOYMENT_CADDY_DOCKER.md` | Déploiement et exploitation staging | Docker, Caddy, commandes, staging |
| `docs/05_ROADMAP.md` | Roadmap et phases | Phases projet, priorités, jalons |
| `docs/06_CI_NOTES.md` | CI et maintenance build | Node, pnpm, lockfile, Docker checks |
| `docs/07_AGENT_WORKFLOW.md` | Workflow Codex/Copilot/agents IA | Issues atomiques, PR, revue, garde-fous |
| `docs/PHASE_F_PUBLISHER_ACCOUNTS.md` | Détail Phase F | Comptes publishers, OAuth admin, validation staging |
| `docs/LINKEDIN_REAL_TEST_RUNBOOK.md` | Runbook test LinkedIn réel | Procédure temporaire, contrôlée, réversible |

---

## 5. Rôle cible de MASTER_PROJECT_TRACKING.md

`MASTER_PROJECT_TRACKING.md` doit devenir :

```text
un document cœur, court, stable, décisionnel.
```

Contenu recommandé :

```text
1. Résumé exécutif du projet
2. État global actuel
3. Principes non négociables
4. Architecture logique ultra-synthétique
5. Statuts métier actifs
6. Phase actuelle et prochaines priorités
7. Index des sources de vérité spécialisées
8. Décisions structurantes récentes
9. Points bloquants ou risques actifs
10. Règle de mise à jour documentaire
```

Taille cible :

```text
150 à 250 lignes maximum.
```

---

## 6. Doublons et chevauchements identifiés

### 6.1 Vision

Présente dans :

```text
MASTER_PROJECT_TRACKING.md
00_PROJECT_VISION.md
README.md
```

Répartition cible :

- `00_PROJECT_VISION.md` : vision complète ;
- `README.md` : résumé public ;
- `MASTER_PROJECT_TRACKING.md` : résumé court et lien.

### 6.2 Architecture

Présente dans :

```text
MASTER_PROJECT_TRACKING.md
01_ARCHITECTURE.md
README.md
```

Répartition cible :

- détails dans `01_ARCHITECTURE.md` ;
- synthèse dans `MASTER_PROJECT_TRACKING.md` ;
- README reste haut niveau.

### 6.3 Sécurité

Présente dans :

```text
MASTER_PROJECT_TRACKING.md
03_SECURITY_MODEL.md
PHASE_F_PUBLISHER_ACCOUNTS.md
LINKEDIN_REAL_TEST_RUNBOOK.md
```

Répartition cible :

- doctrine générale dans `03_SECURITY_MODEL.md` ;
- sécurité OAuth Phase F dans `PHASE_F_PUBLISHER_ACCOUNTS.md` ;
- sécurité test réel dans `LINKEDIN_REAL_TEST_RUNBOOK.md` ;
- master conserve uniquement les principes non négociables et les risques actifs.

### 6.4 Roadmap et phases

Présente dans :

```text
MASTER_PROJECT_TRACKING.md
05_ROADMAP.md
PHASE_F_PUBLISHER_ACCOUNTS.md
```

Répartition cible :

- roadmap complète dans `05_ROADMAP.md` ;
- détail Phase F dans `PHASE_F_PUBLISHER_ACCOUNTS.md` ;
- master conserve phase actuelle et prochain jalon.

### 6.5 Exploitation et commandes

Présente dans :

```text
MASTER_PROJECT_TRACKING.md
04_DEPLOYMENT_CADDY_DOCKER.md
LINKEDIN_REAL_TEST_RUNBOOK.md
```

Répartition cible :

- commandes générales staging dans `04_DEPLOYMENT_CADDY_DOCKER.md` ;
- commandes LinkedIn réel dans `LINKEDIN_REAL_TEST_RUNBOOK.md` ;
- master ne doit pas contenir de longs blocs shell.

---

## 7. Structure documentaire cible

Structure cible recommandée :

```text
docs/
├── MASTER_PROJECT_TRACKING.md          # cœur décisionnel, court
├── DOCUMENTATION_AUDIT.md              # audit et plan de refactor documentaire
├── 00_PROJECT_VISION.md                # vision détaillée
├── 01_ARCHITECTURE.md                  # architecture logique
├── 02_NOSTR_EVENT_MODEL.md             # modèle Nostr
├── 03_SECURITY_MODEL.md                # sécurité
├── 04_DEPLOYMENT_CADDY_DOCKER.md       # staging / exploitation Docker
├── 05_ROADMAP.md                       # roadmap et phases
├── 06_CI_NOTES.md                      # CI
├── 07_AGENT_WORKFLOW.md                # agents IA
├── PHASE_F_PUBLISHER_ACCOUNTS.md       # Phase F détaillée
└── LINKEDIN_REAL_TEST_RUNBOOK.md       # test LinkedIn réel contrôlé
```

Règle :

```text
Le master pointe vers les docs spécialisées. Les docs spécialisées portent les détails.
```

---

## 8. Documents optionnels à créer seulement si nécessaire

Ne pas créer immédiatement ces fichiers.

Ils ne doivent être ajoutés que si les docs existantes deviennent trop longues :

```text
docs/08_API_ADMIN.md
docs/09_DATA_MODEL.md
docs/10_OPERATION_RUNBOOK.md
```

Règle : créer un nouveau document seulement si un document existant dépasse clairement son rôle.

---

## 9. Plan de refactor recommandé

### Étape 1 — Audit documentaire

Créer ce document :

```text
docs/DOCUMENTATION_AUDIT.md
```

Statut : en cours avec cette PR.

Objectif : documenter le diagnostic, la structure cible et la stratégie de migration sans modifier le master.

### Étape 2 — Réduction de MASTER_PROJECT_TRACKING.md

Remplacer `MASTER_PROJECT_TRACKING.md` par une version courte.

Contenu cible :

```text
- résumé projet ;
- état global ;
- principes non négociables ;
- phase actuelle ;
- index des docs spécialisées ;
- décisions récentes ;
- risques actifs ;
- prochaine priorité.
```

Cette étape doit être une PR dédiée et relue attentivement.

### Étape 3 — Consolidation des docs spécialisées

Compléter seulement les documents spécialisés qui manquent d’informations retirées du master.

Ordre conseillé :

```text
1. docs/04_DEPLOYMENT_CADDY_DOCKER.md pour commandes staging
2. docs/01_ARCHITECTURE.md pour API/admin/data model si nécessaire
3. docs/05_ROADMAP.md pour phases projet
4. docs/03_SECURITY_MODEL.md pour durcissements sécurité
```

### Étape 4 — Reprise de l’issue #3

Une fois le master réduit et son rôle clarifié, reprendre l’issue #3.

La synchronisation du workflow agent IA deviendra alors simple :

- ajouter `docs/07_AGENT_WORKFLOW.md` dans l’index des sources spécialisées ;
- ajouter une décision récente sur le workflow agent IA ;
- vérifier que le master reste court.

---

## 10. Règles de maintenance documentaire

1. Une information détaillée vit dans un document spécialisé.
2. Le master contient la synthèse, le statut et les liens.
3. Une commande longue ne doit pas vivre dans le master.
4. Une phase détaillée ne doit pas vivre dans le master.
5. Un runbook ne doit pas vivre dans le master.
6. Une décision structurante doit être mentionnée dans le master.
7. Un changement d’architecture doit mettre à jour `01_ARCHITECTURE.md` et le master si nécessaire.
8. Un changement de sécurité doit mettre à jour `03_SECURITY_MODEL.md` et le master si risque actif.
9. Une nouvelle phase doit mettre à jour `05_ROADMAP.md` et le statut du master.
10. Toute PR documentaire doit indiquer quel document fait autorité.

---

## 11. Prochaine action recommandée

Après validation de cet audit :

```text
Créer une PR dédiée pour réduire docs/MASTER_PROJECT_TRACKING.md en document cœur.
```

Issue suggérée :

```text
[Agent IA] Réduire MASTER_PROJECT_TRACKING en document cœur
```

Definition of Done suggérée :

```text
- MASTER_PROJECT_TRACKING.md fait moins de 250 lignes.
- Il contient un index clair des documents spécialisés.
- Il conserve les principes non négociables.
- Il conserve l’état courant du projet.
- Il conserve les risques actifs.
- Il ne contient plus de longs blocs de commandes.
- Aucun contenu utile n’est supprimé sans destination identifiée.
```

---

## 12. Verdict

```text
COMMENT — audit créé, structure cible proposée, refactor du master à faire dans une PR dédiée.
```

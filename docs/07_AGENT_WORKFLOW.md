# RelayPress — Workflow agent IA

Ce document décrit l’usage minimal des agents IA dans le dépôt RelayPress.

Objectif : permettre à Codex, GitHub Copilot ou un autre agent IA de travailler sur des tâches limitées, vérifiables et relues humainement.

---

## 1. Principe général

RelayPress doit rester un système éditorial souverain, contrôlé et auditable.

Les agents IA peuvent aider à lire, préparer, implémenter ou relire une tâche, mais ils ne doivent pas remplacer le contrôle humain.

Règle opérationnelle :

```text
Une issue = une tâche = une PR possible.
```

---

## 2. Fichiers de référence

Avant toute modification, relire :

```text
AGENTS.md
README.md
docs/MASTER_PROJECT_TRACKING.md
```

Rôles :

| Fichier | Rôle |
|---|---|
| `AGENTS.md` | Règles de travail pour agents IA |
| `README.md` | Vue synthétique du projet |
| `docs/MASTER_PROJECT_TRACKING.md` | Source de vérité opérationnelle |
| `.github/ISSUE_TEMPLATE/00-agent-task.yml` | Formulaire d’issue agent IA |
| `.github/pull_request_template.md` | Template de PR |

---

## 3. Workflow recommandé

```text
1. Créer une issue agent IA.
2. Définir l’objectif et le hors périmètre.
3. Demander une lecture du dépôt sans modification.
4. Valider le plan humainement.
5. Implémenter uniquement le plan validé.
6. Ouvrir une PR avec le template GitHub.
7. Relire le diff avant merge.
```

---

## 4. Règles de sécurité

Ne jamais demander à un agent IA de :

- modifier des secrets ;
- activer une publication réelle sans validation explicite ;
- modifier l’architecture sans justification ;
- ajouter une dépendance sans accord ;
- traiter plusieurs sujets dans une seule issue ;
- faire un refactor opportuniste.

Le mode de publication simulée reste le défaut sûr.

---

## 5. Definition of Done minimale

Une tâche agent IA est terminée seulement si :

- l’objectif de l’issue est rempli ;
- le scope est respecté ;
- les fichiers modifiés sont listés ;
- les vérifications sont indiquées ;
- les risques ou limites sont signalés ;
- la documentation est mise à jour si nécessaire ;
- la prochaine action est claire.

---

## 6. Bon usage

Bon prompt :

```text
Lis le dépôt en mode lecture seule, relis AGENTS.md et docs/MASTER_PROJECT_TRACKING.md, puis propose un plan sans modifier les fichiers.
```

Mauvais prompt :

```text
Corrige tout ce qui ne va pas dans le projet.
```

Le second prompt est trop large. Il produit du hors-scope, des diffs illisibles et des décisions non contrôlées.

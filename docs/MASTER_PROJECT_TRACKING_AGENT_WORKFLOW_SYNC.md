# RelayPress — Synchronisation workflow agent IA

Date : 2026-05-11

## Contexte

RelayPress dispose désormais d’un workflow agent IA documenté et utilisable par Codex, GitHub Copilot ou un autre agent IA.

Fichiers concernés :

```text
AGENTS.md
.github/ISSUE_TEMPLATE/00-agent-task.yml
.github/pull_request_template.md
docs/07_AGENT_WORKFLOW.md
```

## Décision

Le workflow agent IA est considéré comme un élément structurant du dépôt.

Il doit être reflété dans `docs/MASTER_PROJECT_TRACKING.md`, car ce document reste la source de vérité opérationnelle de RelayPress.

## Section recommandée à intégrer dans MASTER_PROJECT_TRACKING

Proposition d’insertion dans la section `3. État actuel du dépôt`, après le bloc `Socle validé` ou dans la structure projet :

```markdown
### Workflow agent IA validé

RelayPress dispose désormais d’un workflow agent IA minimal pour cadrer les tâches traitables par Codex, GitHub Copilot ou un autre agent IA.

Fichiers structurants :

```text
AGENTS.md
.github/ISSUE_TEMPLATE/00-agent-task.yml
.github/pull_request_template.md
docs/07_AGENT_WORKFLOW.md
```

Règle opérationnelle :

```text
Une issue = une tâche = une PR possible.
```

Ce workflow impose :

- lecture préalable de `AGENTS.md`, `README.md` et `docs/MASTER_PROJECT_TRACKING.md` ;
- objectif borné ;
- hors périmètre explicite ;
- Definition of Done ;
- PR dédiée ;
- revue humaine avant merge.
```

## Limite de cette PR

Cette PR ajoute une note de synchronisation séparée pour éviter d’écraser `docs/MASTER_PROJECT_TRACKING.md` pendant une modification automatisée.

La modification directe du fichier maître devra être faite avec un outil capable de préserver l’intégralité du fichier sans troncature.

## Vérifications

```text
- Aucun code modifié.
- Aucune infrastructure modifiée.
- Aucun secret ajouté.
- Documentation uniquement.
```

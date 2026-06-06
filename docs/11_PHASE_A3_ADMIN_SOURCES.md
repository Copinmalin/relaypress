# Phase A3 — Admin sources récupérées

Ce document trace l'implémentation de la PR A3.

Objectif : afficher les `source_items`, permettre le filtrage par provider et statut, puis permettre une action humaine minimale : sélectionner, ignorer ou archiver.

---

## Périmètre réalisé

Routes API ajoutées :

```text
GET  /source-items
GET  /source-items/:id
POST /source-items/:id/selected
POST /source-items/:id/ignored
POST /source-items/:id/archived
```

Page admin ajoutée :

```text
/admin/sources
```

La page permet :

- affichage des sources récupérées ;
- filtre par provider ;
- filtre par statut ;
- tri ascendant ou descendant ;
- changement de statut vers `selected`, `ignored` ou `archived` ;
- copie de l'URL canonique ou source ;
- affichage des métadonnées.

---

## Garde-fous respectés

- aucune génération IA ;
- aucune création de campagne ;
- aucune création de `publication_jobs` ;
- aucune publication réelle ou mock ;
- aucune intégration Telegram ;
- accès protégé par `ADMIN_API_TOKEN` via Bearer token ;
- les actions changent uniquement le statut de `source_items`.

---

## Statuts actionnables

L'interface admin permet uniquement :

```text
selected
ignored
archived
```

Les autres statuts restent affichables, mais ne sont pas utilisés comme actions directes dans cette PR.

---

## Prochaine étape

PR A4 / Phase B : préparer le passage d'un `SourceItem` sélectionné vers un futur `EditorialSignal`, sans créer automatiquement de contenu publiable.

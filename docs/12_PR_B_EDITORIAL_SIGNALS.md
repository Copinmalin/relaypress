# PR B — Editorial Signals

Ce document trace l'implémentation de la phase PR B.

Objectif : créer le modèle `EditorialSignal`, le rattacher à `source_items`, et permettre une qualification humaine minimale d'une source sélectionnée.

---

## Périmètre réalisé

Table ajoutée :

```text
editorial_signals
```

Champs :

```text
id
source_item_id
category
summary_internal
editorial_angle
risk_level
status
primary_sources
metadata
created_at
updated_at
```

Routes API ajoutées :

```text
GET  /editorial-signals
GET  /editorial-signals/:id
POST /source-items/:id/editorial-signals
POST /editorial-signals/:id/status
```

---

## Objet métier

Un `EditorialSignal` est une lecture éditoriale humaine d'une source récupérée.

Il ne constitue pas un contenu publiable.

Il sert à conserver :

- une catégorie ;
- un résumé interne ;
- un angle éditorial ;
- un niveau de risque ;
- une liste de sources primaires ou complémentaires ;
- un statut de traitement.

---

## Statuts

Statuts initiaux :

```text
qualified
needs_sources
ready_for_campaign
ignored
archived
```

Aucun de ces statuts ne déclenche une campagne ou une publication.

---

## Niveaux de risque

```text
low
medium
high
```

Le niveau de risque sert à forcer une discipline éditoriale plus stricte avant les futures phases de campagne ou de génération.

---

## Garde-fous respectés

- aucune IA automatique ;
- aucune campagne automatique ;
- aucune création de `publication_jobs` ;
- aucune publication réelle ou mock ;
- rattachement explicite à `source_items` ;
- actions protégées par `ADMIN_API_TOKEN` ;
- conservation de la source d'origine via `source_item_id`.

---

## Prochaine étape

PR C : permettre de créer des jobs depuis un signal ou une source, avec sélection explicite des plateformes, toujours sans publication automatique.

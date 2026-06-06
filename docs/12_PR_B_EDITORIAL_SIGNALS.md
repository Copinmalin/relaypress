# PR B — Editorial Signals

Ce document trace l'implémentation de la phase PR B.

Objectif : créer le modèle `EditorialSignal`, le rattacher à `source_items`, et préparer la qualification humaine future d'une source sélectionnée.

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

Types partagés ajoutés :

```text
EditorialSignal
EditorialSignalStatus
EditorialSignalRiskLevel
EditorialSignalCategory
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
- conservation de la source d'origine via `source_item_id`.

---

## Hors périmètre PR B

Les routes API de qualification ne font pas partie du périmètre fusionné en PR B.

Elles sont traitées dans PR C afin de garder une découpe atomique : modèle d'abord, qualification ensuite.

---

## Prochaine étape

PR C : permettre de qualifier une source `selected` en `EditorialSignal`, sans IA, sans campagne et sans publication automatique.

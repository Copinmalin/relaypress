# Phase A — Source Items

Ce document cadre le premier incrément technique après le cadrage du Signal Engine.

Objectif : introduire une couche de **sources éditoriales récupérées** avant toute génération IA, campagne ou publication.

Le périmètre est volontairement étroit : BTC Breakdown d'abord, stockage minimal, affichage admin ensuite, aucune publication automatique.

---

## 1. Rôle de la phase A

La phase A crée la matière première exploitable par le futur Signal Engine.

```text
BTC Breakdown
→ source item récupéré
→ stockage PostgreSQL
→ affichage admin
→ sélection humaine
→ signal éditorial ou campagne dans une phase ultérieure
```

Un `SourceItem` n'est pas un contenu publiable.

Un `SourceItem` est une référence éditoriale brute, conservée pour audit, que l'humain peut choisir d'exploiter ou d'ignorer.

---

## 2. Hors périmètre strict

La phase A ne doit pas inclure :

- génération IA ;
- création automatique de campagnes ;
- création automatique de `publication_jobs` ;
- publication réelle ou mock ;
- intégration Telegram ;
- scraping de réseaux sociaux ;
- récupération de contenu premium non autorisé ;
- scoring opaque de personnes ;
- automatisation de DM, commentaires ou interactions sociales.

---

## 3. Provider initial

Provider initial unique :

```text
btcbreakdown
```

Rôle : radar Bitcoin-only.

Usage : détecter des liens, titres et thèmes exploitables, puis préparer une sélection humaine.

BTC Breakdown ne doit pas être utilisé comme texte à republier tel quel. Les contenus longs doivent être remplacés par des extraits courts, des résumés internes et des liens vers les sources.

---

## 4. Modèle métier cible : SourceItem

Objet conceptuel minimal :

```text
SourceItem
- id
- provider
- source_url
- canonical_url
- title
- excerpt
- language
- status
- metadata
- fetched_at
- created_at
- updated_at
```

Champs recommandés :

| Champ | Rôle |
|---|---|
| `id` | identifiant interne stable |
| `provider` | nom du provider, `btcbreakdown` au démarrage |
| `source_url` | URL récupérée initialement |
| `canonical_url` | URL normalisée si disponible |
| `title` | titre court affichable dans l'admin |
| `excerpt` | extrait court, non substantiel |
| `language` | langue source, `en` par défaut |
| `status` | état de traitement éditorial |
| `metadata` | données techniques ou éditoriales non critiques |
| `fetched_at` | date de récupération |
| `created_at` | date de création en base |
| `updated_at` | date de dernière modification |

---

## 5. Statuts SourceItem

Statuts initiaux proposés :

```text
new        = source récupérée, non examinée
selected   = source retenue humainement pour traitement ultérieur
ignored    = source non retenue mais conservée
archived   = source masquée des vues actives, conservée pour audit
failed     = récupération ou parsing incomplet
```

Règles :

- `archived` ne supprime pas l'historique ;
- `ignored` doit rester réversible dans une future interface admin ;
- `failed` ne doit pas bloquer les autres sources ;
- aucun statut ne doit déclencher une publication.

---

## 6. Contraintes base de données

Table cible :

```text
source_items
```

Index recommandés :

```text
source_items_provider_idx(provider)
source_items_status_idx(status)
source_items_fetched_at_idx(fetched_at)
source_items_provider_canonical_url_idx(provider, canonical_url)
```

Le couple `provider + canonical_url` doit éviter les doublons quand l'URL canonique est disponible.

Si `canonical_url` est absente, l'implémentation doit normaliser `source_url` avant insertion ou conserver un comportement idempotent explicite.

---

## 7. Cadence d'ingestion cible

Cadence initiale :

```text
Toutes les 12 heures
```

Fenêtres indicatives :

```text
06:00
18:00
```

Cette cadence est une cible produit. L'implémentation peut commencer par une commande manuelle ou un worker déclenché au démarrage, puis évoluer vers une planification explicite.

---

## 8. Garde-fous éditoriaux

Chaque `SourceItem` doit permettre de garder la traçabilité :

- URL source ;
- provider ;
- titre ;
- extrait court ;
- date de récupération ;
- métadonnées utiles.

Interdictions :

- stocker un article complet tiers ;
- traduire intégralement un article tiers ;
- masquer la source ;
- convertir directement une source en publication ;
- faire dépendre le système d'un canal social ou Telegram.

---

## 9. Garde-fous techniques

La première implémentation doit :

- rester compatible Node 24 ;
- éviter les dépendances nouvelles si `fetch` natif suffit ;
- conserver `PUBLISHER_MODE=mock` comme défaut sûr ;
- ne pas toucher aux secrets ;
- ne pas modifier les publishers réels ;
- journaliser les erreurs sans contenu sensible ;
- échouer proprement si BTC Breakdown est indisponible.

---

## 10. Étapes d'implémentation recommandées

### PR A1 — Schéma SourceItem

- ajouter `source_items` au schéma DB ;
- ajouter la migration idempotente ;
- ajouter les types partagés minimaux ;
- aucune ingestion réelle.

### PR A2 — Ingestion BTC Breakdown minimale

- récupérer une liste de contenus BTC Breakdown ;
- extraire URL, titre, extrait court si disponible ;
- insérer sans doublon ;
- aucune IA.

### PR A3 — Admin sources

- afficher les `SourceItem` ;
- filtrer par provider et statut ;
- permettre `selected`, `ignored`, `archived` ;
- ne pas créer de job automatiquement.

### PR A4 — Liaison future Signal Engine

- préparer le passage d'un `SourceItem` à un `EditorialSignal` ;
- garder le Signal Engine séparé des `publication_jobs` ;
- ne pas générer de campagne dans cette PR.

---

## 11. Definition of Done phase A documentaire

Cette phase documentaire est correcte si :

- le rôle de `SourceItem` est clair ;
- BTC Breakdown est cadré comme provider initial ;
- Telegram est hors scope technique ;
- aucun contenu publiable n'est généré automatiquement ;
- la roadmap technique reste atomique ;
- les garde-fous copyright, sécurité et audit sont explicites.

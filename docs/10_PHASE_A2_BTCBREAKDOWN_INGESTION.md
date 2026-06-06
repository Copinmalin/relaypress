# Phase A2 — Ingestion BTC Breakdown minimale

Ce document trace l'implémentation de la PR A2.

Objectif : récupérer une liste courte de contenus BTC Breakdown, extraire les métadonnées minimales, puis insérer les éléments dans `source_items` sans doublon.

---

## Périmètre réalisé

Fichier principal :

```text
services/worker/src/sources/btcbreakdown.ts
```

Fonction exposée :

```text
ingestBtcBreakdownSourceItems()
```

Le worker :

1. récupère le HTML de `BTCBREAKDOWN_BASE_URL` ;
2. extrait les liens internes d'articles `/p/` ;
3. limite le nombre de candidats via `SOURCE_INGESTION_BATCH_SIZE` ;
4. récupère les pages candidates ;
5. extrait le titre depuis Open Graph, Twitter Card ou `<title>` ;
6. extrait un court descriptif si disponible ;
7. normalise l'URL canonique ;
8. insère dans `source_items` avec déduplication par `provider + canonical_url`.

---

## Variables d'environnement

```text
SOURCE_INGESTION_ENABLED=true
SOURCE_INGESTION_BATCH_SIZE=10
SOURCE_INGESTION_INTERVAL_MS=43200000
BTCBREAKDOWN_BASE_URL=https://www.btcbreakdown.com
```

`43200000` ms correspond à 12 heures.

---

## Garde-fous respectés

- aucune IA ;
- aucune campagne ;
- aucune création de `publication_jobs` ;
- aucune publication ;
- aucune intégration Telegram ;
- aucune dépendance nouvelle ;
- pas de stockage d'article complet ;
- insertion idempotente via conflit sur `provider + canonical_url` ;
- erreurs journalisées sans secret.

---

## Limites connues

Cette première version utilise l'extraction HTML minimale depuis la page d'accueil BTC Breakdown.

Elle ne dépend pas d'un flux RSS, d'une API privée ou d'un contenu payant.

Si BTC Breakdown modifie fortement sa structure HTML, l'extraction pourra ne rien insérer. Ce comportement est acceptable pour cette phase : l'échec doit rester silencieux côté publication et visible dans les logs worker.

---

## Prochaine étape

PR A3 : ajouter une vue admin des `SourceItem` permettant de voir, filtrer et changer le statut des sources récupérées sans créer automatiquement de publication.

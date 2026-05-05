# Architecture RelayPress

RelayPress est une architecture d’orchestration éditoriale souveraine pilotée par Nostr.

Le principe central est de séparer clairement l’intention, l’état métier, l’adaptation, la validation humaine, la publication et l’audit.

## Vue générale MVP

```txt
Nostr event ou brouillon manuel
        ↓
API admin / indexer Nostr
        ↓
publication_jobs dans PostgreSQL
        ↓
Adaptation déterministe par plateforme
        ↓
Validation humaine dans l’admin
        ↓
Worker publisher orchestrator
        ↓
Publisher mock ou publisher réel préparé
        ↓
publication_job_runs + audit
        ↓
Archivage non destructif
```

## Rôles des briques

### Nostr

Nostr porte l’intention signée et le journal souverain.

Il sert à déclencher des jobs éditoriaux depuis des événements autorisés, par exemple via :

```txt
/publish x linkedin
Texte à publier
```

ou via tags :

```txt
#publish #x
```

Nostr ne remplace pas PostgreSQL pour l’état métier.

### Relay privé strfry

Le relay privé est le registre canonique des événements éditoriaux contrôlés.

En staging, il est fourni par `strfry` et exposé derrière Caddy.

### PostgreSQL

PostgreSQL stocke l’état opérationnel :

- événements Nostr indexés ;
- jobs de publication ;
- contenus source et adaptés ;
- statuts ;
- erreurs ;
- runs de publication ;
- IDs externes ;
- dates de publication.

Tables principales :

```txt
nostr_events
publication_jobs
publication_job_runs
```

### API Fastify

L’API fournit :

- healthchecks ;
- interface admin ;
- assets admin ;
- endpoints protégés de lecture et écriture des jobs ;
- actions métier : edit, readapt, approve, reject, retry, reset-review, archive.

Les endpoints éditoriaux sont protégés par `ADMIN_API_TOKEN`.

### Interface admin

L’admin est une console utilitaire de staging, pas encore une interface produit finalisée.

Fonctions actuelles :

- vue À traiter ;
- vue actifs ;
- vue archives ;
- filtre par statut, plateforme, ordre ;
- création de brouillons manuels multi-plateforme ;
- comparaison source/adapted ;
- édition humaine ;
- validation/rejet ;
- readapt ;
- retry ;
- reset-review ;
- visualisation des runs ;
- archivage individuel et groupé.

### Worker

Le worker exécute :

- l’indexation Nostr ;
- la création de jobs depuis événements ;
- le claim atomique des jobs `approved` ;
- la publication via publisher sélectionné ;
- l’écriture des runs ;
- les transitions `publishing`, `published`, `failed`.

### Publisher orchestrator

Le worker passe par une couche commune :

```txt
services/worker/src/publisher/index.ts
```

Elle sélectionne le publisher selon `PUBLISHER_MODE`, vérifie `isReady()`, limite les plateformes compatibles et empêche de claim des jobs si le publisher n’est pas prêt.

### Publisher mock

Mode par défaut :

```txt
PUBLISHER_MODE=mock
```

Il permet de tester tout le pipeline sans publication publique.

### Publisher LinkedIn réel

Mode préparé :

```txt
PUBLISHER_MODE=linkedin_real
```

État actuel : stub volontairement non connecté.

Le worker ne doit pas publier réellement tant que l’OAuth, l’URN auteur, les erreurs API et le stockage chiffré des tokens ne sont pas durcis.

## Modèle de données logique

```txt
nostr_events
  → journal applicatif des événements indexés

publication_jobs
  → état métier par plateforme
  → source_content conservé
  → adapted_content validable et publiable

publication_job_runs
  → historique de chaque tentative de publication
  → raw_response conservée
```

## Statuts métier

```txt
pending         = job créé automatiquement, à traiter
pending_review  = brouillon manuel ou contenu à relire
approved        = validé, prêt worker
publishing      = claim par le worker, publication en cours
published       = publié ou simulé via mock
rejected        = refusé
failed          = tentative échouée
archived        = conservé pour audit, masqué des vues actives
```

## Règles de conception

Chaque publication externe doit pouvoir être reliée à :

1. une intention signée ou un brouillon manuel ;
2. un contenu source conservé ;
3. une adaptation par plateforme ;
4. une validation humaine ;
5. un run d’exécution ;
6. un résultat publié, échoué ou archivé.

## Architecture cible ultérieure

Les briques suivantes restent prévues mais ne sont pas encore le cœur du MVP :

- IA provider réel ;
- Policy Engine complet ;
- scheduler avancé ;
- comptes publishers multi-utilisateurs ;
- tokens OAuth chiffrés ;
- publishers X, Facebook, Instagram, Mastodon, WordPress ;
- authentification web propre ;
- monitoring et sauvegardes automatisées.

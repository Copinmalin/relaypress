# Architecture

## Vue générale

```txt
Client Nostr / Console web
        ↓
Relay privé souverain
        ↓
Indexer / Event Listener
        ↓
Command Interpreter
        ↓
Scenario Engine
        ↓
Scheduler
        ↓
AI Content Engine
        ↓
Validation / Policy Engine
        ↓
Formatting Engine
        ↓
Publication Queue
        ↓
Publishers externes
        ↓
Audit log + métriques + archivage Nostr
```

## Composants

### Relay privé

Le relay privé reçoit les événements Nostr qui servent de source ou de commande.

Il ne remplace pas PostgreSQL. Il joue le rôle de journal souverain.

### API

L’API HTTP exposera :

- l’état du système ;
- les scénarios éditoriaux ;
- les campagnes ;
- les brouillons ;
- les validations ;
- les connexions OAuth ;
- les journaux d’exécution.

### Worker

Le worker exécute les tâches longues :

- indexation des événements Nostr ;
- interprétation des commandes ;
- génération IA ;
- adaptation par plateforme ;
- planification ;
- publication ;
- retries ;
- écriture des résultats.

### PostgreSQL

PostgreSQL stocke l’état métier :

- comptes ;
- connexions plateformes ;
- événements indexés ;
- scénarios ;
- jobs ;
- statuts ;
- erreurs ;
- résultats de publication.

### Redis

Redis sert à la file d’attente et aux tâches asynchrones.

### Caddy

Caddy est le reverse proxy TLS devant l’API, la console web future et le relay Nostr.

## Règle de conception

Chaque publication externe doit pouvoir être reliée à :

1. une intention signée ;
2. un scénario ou une source ;
3. une génération ou adaptation ;
4. une validation ou une politique ;
5. un résultat de publication.

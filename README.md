# RelayPress

**RelayPress** est un système d’orchestration éditoriale souverain piloté par Nostr.

L’objectif n’est pas de faire un simple crossposter. L’objectif est de construire une infrastructure où Nostr sert de registre canonique, de bus d’événements et de plan de contrôle pour produire, programmer, valider et diffuser du contenu vers des plateformes externes comme X, LinkedIn, Facebook, Instagram, Mastodon ou WordPress.

## Vision

```txt
Nostr = journal souverain + bus de commande + source éditoriale
Relay privé = registre canonique des intentions signées
IA = moteur de génération, adaptation et contrôle qualité
PostgreSQL = état métier applicatif
Queue = exécution fiable des jobs
Plateformes sociales = canaux de distribution secondaires
```

## Objectifs

- Publier depuis Nostr sans dépendre d’un back-office propriétaire.
- Configurer des scénarios éditoriaux via événements Nostr signés.
- Générer du contenu avec une IA encadrée par des règles.
- Programmer des campagnes de publication.
- Adapter automatiquement les contenus à chaque plateforme.
- Conserver un audit complet : intention, génération, validation, publication, résultat.
- Héberger l’ensemble avec Docker et Caddy sur un serveur souverain.

## Principes non négociables

- Pas de stockage de `nsec` en clair.
- Pas de scraping de réseaux sociaux.
- Publication via API officielles.
- Validation humaine obligatoire pour les contenus sensibles.
- Journalisation des intentions et résultats dans Nostr.
- Architecture modulaire : relay, API, worker, IA, publishers.

## Structure du dépôt

```txt
.
├── docs/                    # Vision, architecture, sécurité, modèle Nostr
├── infra/                   # Caddy, relay, configuration serveur
├── packages/shared/         # Types et constantes partagés
├── services/api/            # API HTTP + console d’administration future
├── services/worker/         # Indexer Nostr, scheduler, IA, publication
├── scripts/                 # Scripts d’initialisation et déploiement
├── docker-compose.yml       # Stack locale / serveur
├── .env.example             # Variables d’environnement documentées
└── README.md
```

## Démarrage local

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Avec Docker :

```bash
docker compose up -d --build
```

## Licence

Ce projet est placé sous licence **AGPL-3.0-or-later**.

Cette licence est volontairement protectrice pour un projet serveur : si RelayPress est modifié et exploité comme service réseau, les améliorations doivent rester accessibles à la communauté.

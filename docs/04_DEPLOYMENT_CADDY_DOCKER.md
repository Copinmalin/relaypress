# Déploiement Caddy / Docker

RelayPress est conçu pour être déployé sur un VPS avec Docker Compose et Caddy.

## Services prévus

- `caddy` : reverse proxy TLS ;
- `api` : API HTTP RelayPress ;
- `worker` : tâches asynchrones ;
- `postgres` : état métier ;
- `redis` : file d’attente ;
- `strfry` : relay Nostr privé ou semi-privé.

## Préparation serveur

```bash
sudo apt update
sudo apt install -y git curl ufw ca-certificates
```

Installer Docker selon la documentation officielle de la distribution utilisée.

## Arborescence cible

```txt
/opt/relaypress
├── .env
├── docker-compose.yml
├── infra/
└── data/
```

## Premier lancement

```bash
git clone https://github.com/Copinmalin/relaypress.git /opt/relaypress
cd /opt/relaypress
cp .env.example .env
nano .env
docker compose up -d --build
```

## Points à durcir avant production

- remplacer tous les secrets par des valeurs longues et uniques ;
- définir les domaines réels ;
- configurer les sauvegardes PostgreSQL ;
- limiter l’écriture sur le relay ;
- activer les métriques ;
- définir la stratégie de logs ;
- vérifier les ports exposés ;
- documenter la restauration complète.

# Déploiement Caddy / Docker

RelayPress est conçu pour être déployé sur un VPS avec Docker Compose et Caddy.

Le staging validé repose sur :

```txt
caddy
postgres
redis
strfry
api
worker
```

## Rôle des services

```txt
caddy    = reverse proxy HTTPS
postgres = base métier PostgreSQL
redis    = queue/cache futur
strfry   = relay Nostr privé
api      = API Fastify + interface admin + assets admin
worker   = indexation Nostr + orchestration publisher
```

## Volumes persistants

```txt
caddy_data
caddy_config
postgres_data
redis_data
strfry_data
```

## Préparation serveur

```bash
sudo apt update
sudo apt install -y git curl ufw ca-certificates
```

Installer Docker et Docker Compose selon la documentation officielle de la distribution utilisée.

Configuration firewall minimale :

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Arborescence cible

```txt
/opt/relaypress
├── .env
├── docker-compose.yml
├── infra/
├── services/
├── packages/
└── docs/
```

## Premier lancement

```bash
git clone https://github.com/Copinmalin/relaypress.git /opt/relaypress
cd /opt/relaypress
cp .env.example .env
nano .env
docker compose up -d --build
```

## Variables critiques

Ne jamais commiter les valeurs réelles.

À remplacer avant exposition publique :

```txt
POSTGRES_PASSWORD
ADMIN_API_TOKEN
TOKEN_ENCRYPTION_KEY
SESSION_SECRET
```

Mode sûr par défaut :

```txt
PUBLISHER_MODE=mock
AI_PROVIDER=mock
```

Le mode `linkedin_real` est préparé mais ne doit pas être activé sans token LinkedIn contrôlé, `LINKEDIN_AUTHOR_URN` exact et validation explicite.

## Déploiement complet staging

```bash
cd /opt/relaypress
git pull
docker compose up -d --build

export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"
echo "Token length: ${#ADMIN_API_TOKEN}"
```

## Redéploiement API seul

```bash
cd /opt/relaypress
git pull
docker compose up -d --build api

export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"
echo "Token length: ${#ADMIN_API_TOKEN}"
```

## Redéploiement worker seul

```bash
cd /opt/relaypress
git pull
docker compose up -d --build worker

export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"
echo "Token length: ${#ADMIN_API_TOKEN}"
```

## Vérifications utiles

Healthchecks :

```bash
curl -s https://api.relaypress.copinmalin.top/health | jq
curl -s https://app.relaypress.copinmalin.top/health | jq
```

Lecture des jobs à traiter :

```bash
cd /opt/relaypress
export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"

curl -s \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://api.relaypress.copinmalin.top/publication-jobs?view=todo&order=desc" | jq
```

Logs :

```bash
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f caddy
```

État des conteneurs :

```bash
docker compose ps
```

## Points à durcir avant production

- sauvegardes PostgreSQL automatisées ;
- sauvegardes du volume `strfry_data` ;
- rotation et rétention des logs ;
- monitoring disque et conteneurs ;
- alertes ;
- rate limiting API ;
- authentification web propre ;
- stockage chiffré des tokens OAuth ;
- rotation des secrets ;
- procédure de restauration complète testée.

#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env ]; then
  cp .env.example .env
fi

corepack enable
pnpm install --frozen-lockfile=false
pnpm typecheck
pnpm build
docker compose config
docker compose build

echo "RelayPress local validation completed successfully."

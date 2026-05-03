#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env ]; then
  cp .env.example .env
fi

if [ ! -f pnpm-lock.yaml ]; then
  echo "pnpm-lock.yaml is missing. Run pnpm install --lockfile-only and commit the result."
  exit 1
fi

corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
docker compose config
docker compose build

echo "RelayPress local validation completed successfully."

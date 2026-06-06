# CI notes

La CI du dépôt est stabilisée autour de Node 24, pnpm et Docker Compose.

## État actuel

Le lockfile `pnpm-lock.yaml` est obligatoire et doit rester versionné.

La CI exécute :

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm check
cp .env.example .env
docker compose config
docker compose build api worker
```

## Règles de maintenance

- Ne pas supprimer `pnpm-lock.yaml`.
- Toute modification de dépendance doit mettre à jour le lockfile.
- La version pnpm cible est `9.15.0`.
- La version Node cible est `24`.
- Les workflows GitHub Actions forcent l’usage Node 24 pour les actions JavaScript.
- `.env.example` doit rester suffisant pour valider `docker compose config`.
- Toute PR doit passer `pnpm lint`, `pnpm typecheck`, `pnpm build` et `pnpm check` avant merge.

## Workflow lockfile

Si les dépendances changent :

```bash
pnpm install
pnpm check
git add package.json pnpm-lock.yaml
git commit -m "chore: update dependencies"
```

Si le lockfile doit être régénéré sans installation complète :

```bash
pnpm install --lockfile-only
```

Le workflow `generate-lockfile.yml` peut aussi servir de filet de sécurité, mais la voie normale reste une mise à jour locale puis un commit explicite.

## Point de vigilance

La CI vérifie désormais la cohérence dépôt + Docker. Un changement dans les variables d’environnement, Dockerfiles, services API/worker ou dépendances doit donc garder ces trois niveaux alignés :

```txt
package.json / pnpm-lock.yaml
.env.example
docker-compose.yml
```

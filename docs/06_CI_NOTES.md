# CI bootstrap notes

The repository currently does not commit a `pnpm-lock.yaml` file.

During the bootstrap phase, CI intentionally runs:

```bash
pnpm install --frozen-lockfile=false
```

Do not enable `cache: pnpm` in `actions/setup-node` until a lockfile is committed, because GitHub Actions requires `pnpm-lock.yaml` for that cache mode.

Once the dependency tree is stabilized, generate and commit the lockfile locally:

```bash
pnpm install
pnpm build
git add pnpm-lock.yaml
git commit -m "Add pnpm lockfile"
```

After that, pnpm cache can be re-enabled safely in the workflow.

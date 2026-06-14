# AGENTS.md

Instructions pour les agents IA qui travaillent sur le dépôt RelayPress.

RelayPress est un système d’orchestration éditoriale souverain piloté par Nostr. L’objectif n’est pas de construire un simple crossposter, mais un pipeline contrôlé : intention éditoriale signée, état métier opérationnel, adaptation par plateforme, validation humaine, publication et audit d’exécution.

---

## 1. Source de vérité

La source de vérité opérationnelle du projet est :

```text
docs/MASTER_PROJECT_TRACKING.md
```

Avant toute modification significative, relire au minimum :

```text
README.md
docs/MASTER_PROJECT_TRACKING.md
```

Si la tâche touche à l’architecture, à la sécurité, aux statuts métier, au publisher réel, à l’IA ou au déploiement, mettre à jour `docs/MASTER_PROJECT_TRACKING.md` ou signaler explicitement pourquoi aucune mise à jour n’est nécessaire.

---

## 2. Principes non négociables

- Nostr reste la racine souveraine des intentions éditoriales.
- PostgreSQL porte l’état métier opérationnel.
- Aucun `nsec` ne doit être stocké en clair.
- Les tokens OAuth ne doivent jamais être ajoutés au dépôt.
- Les tokens OAuth devront être chiffrés avant tout branchement réel.
- Pas de scraping de réseaux sociaux.
- Publication externe uniquement via API officielles.
- Les contenus sensibles doivent rester soumis à validation humaine.
- Les actions importantes doivent être auditables.
- Un job déjà publié ne doit jamais être republié accidentellement.
- Le mode `mock` reste le mode par défaut tant que LinkedIn réel n’est pas durci.

---

## 3. Stack et conventions techniques

RelayPress utilise :

```text
Node 24
pnpm 9.15+
TypeScript NodeNext
Monorepo pnpm
Fastify pour l’API
Worker Node pour Nostr et publishers
PostgreSQL
Redis
strfry
Docker Compose
Caddy
```

Scripts principaux :

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
pnpm check
```

`pnpm-lock.yaml` est obligatoire. Ne pas supprimer, régénérer ou modifier le lockfile sans raison explicite.

---

## 4. Règles de modification

Avant de modifier :

1. Identifier l’objectif exact.
2. Lire les fichiers concernés.
3. Vérifier les principes non négociables.
4. Proposer ou suivre un plan court.
5. Modifier uniquement ce qui est nécessaire.
6. Documenter les vérifications réalisées.

Éviter :

- les refactors opportunistes ;
- les changements d’architecture non demandés ;
- les dépendances inutiles ;
- les modifications massives dans une seule PR ;
- les suppressions d’historique ou d’audit ;
- les changements de sécurité implicites.

---

## 5. Règles par zone du dépôt

| Zone | Rôle | Règle |
|---|---|---|
| `.github/` | Workflows, templates issue/PR | garder les templates cohérents avec la méthode agent IA |
| `docs/` | documentation opérationnelle | consolider dans le Master, éviter une note permanente par PR |
| `infra/` | Caddy, strfry, infrastructure | prudence maximale, documenter les effets de bord |
| `packages/db/` | schéma et accès PostgreSQL | préserver audit, runs et transitions métier |
| `packages/shared/` | types et constantes partagés | éviter les breaking changes silencieux |
| `services/api/` | API Fastify et interface admin | préserver protection `ADMIN_API_TOKEN` |
| `services/worker/` | indexer Nostr et publisher | préserver `mock` par défaut et anti-doublon |
| `scripts/` | validations locales | scripts simples, lisibles, non destructifs |

---

## 6. Sécurité

Ne jamais ajouter au dépôt :

- clé privée Nostr ;
- `nsec` ;
- token OAuth ;
- `ADMIN_API_TOKEN` ;
- `TOKEN_ENCRYPTION_KEY` ;
- secret LinkedIn/X/Meta ;
- fichier `.env` réel ;
- log contenant un secret.

Si une tâche touche aux publishers réels, traiter comme critique.

Obligation : conserver `PUBLISHER_MODE=mock` comme défaut sûr tant que le durcissement OAuth, chiffrement, erreurs API et validation humaine n’est pas terminé.

---

## 7. Workflow GitHub attendu

Une issue doit être :

- limitée ;
- vérifiable ;
- liée à une PR possible ;
- dotée d’une Definition of Done ;
- explicite sur le hors périmètre ;
- claire sur les tests attendus.

Utiliser :

```text
.github/ISSUE_TEMPLATE/00-agent-task.yml
.github/pull_request_template.md
```

Pour relire une PR, utiliser aussi la logique de revue définie dans le système IA personnel.

---

## 8. Definition of Done générale

Une tâche est terminée seulement si :

- l’objectif est rempli ;
- le scope est respecté ;
- les tests ou vérifications sont indiqués ;
- les risques restants sont signalés ;
- la documentation est mise à jour si nécessaire ;
- aucune information sensible n’est ajoutée ;
- la prochaine action est claire.

---

## 9. Règle documentaire

- Ne pas créer un nouveau fichier `docs/XX_PR_...` pour chaque PR.
- Mettre à jour `docs/MASTER_PROJECT_TRACKING.md` pour tout changement de doctrine, architecture, sécurité, statuts métier, IA, publisher ou déploiement.
- Créer un document séparé uniquement pour un runbook critique ou une référence stable.
- Supprimer ou archiver les notes de PR une fois leur contenu consolidé.
- Ne pas dupliquer une vérité opérationnelle dans plusieurs fichiers actifs.

---

## 10. Commandes de vérification recommandées

Selon la tâche :

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm check
```

Pour les changements Docker ou staging :

```bash
docker compose config
docker compose up -d --build
```

Ne pas prétendre qu’une commande a été exécutée si elle ne l’a pas été.

---

## 11. Priorité absolue

La priorité est la fiabilité opérationnelle.

RelayPress doit rester un système éditorial souverain, contrôlé, auditable et sûr. Les agents IA doivent accélérer le travail, pas diluer le contrôle humain.

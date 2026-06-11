# RelayPress

**RelayPress** est une application d’orchestration éditoriale souveraine.

Son objectif est de transformer des sources d’information sélectionnées en contenus prêts à publier sur plusieurs canaux, avec génération assistée par IA, validation humaine, publication contrôlée et audit.

RelayPress n’est pas un simple crossposter. Le projet vise une chaîne éditoriale complète :

```txt
source éditoriale
→ sélection humaine
→ génération ou adaptation par canal
→ validation
→ publication contrôlée
→ audit
```

## Objectif global

RelayPress doit permettre de piloter une diffusion éditoriale multi-canal sans perdre le contrôle humain ni la souveraineté du processus.

Les premiers canaux cibles sont :

- **Blog** : format long, structuré, sourcé et analytique ;
- **Nostr** : diffusion souveraine et journal éditorial ;
- **LinkedIn** : communication professionnelle ;
- **X** : posts courts et engagement rapide ;
- **Facebook** : vulgarisation grand public ;
- **Instagram** : publication visuelle et commentaire d’accompagnement.

La première source automatisée visée est **BTC Breakdown**, avec une architecture prévue pour accueillir d’autres sources plus tard.

## Positionnement

RelayPress repose sur quelques choix structurants :

- Nostr reste une racine souveraine pour les intentions éditoriales et le journal de publication ;
- PostgreSQL porte l’état métier opérationnel ;
- l’IA génère des propositions, mais ne publie pas seule ;
- la validation humaine reste obligatoire avant publication réelle ;
- les publishers réels doivent passer par les API officielles ;
- le mode `mock` reste le défaut sûr tant que les sorties réelles ne sont pas validées.

## Workflow cible

```txt
BTC Breakdown ou autre source
→ récupération automatique
→ affichage dans l’admin
→ sélection d’un sujet
→ création d’une campagne éditoriale
→ sélection des plateformes
→ génération IA des formats
→ relecture et édition humaine
→ validation
→ publication API ou mock
→ audit des runs
```

## État actuel

Le dépôt contient déjà un MVP éditorial fonctionnel en staging :

- création de jobs éditoriaux depuis Nostr ou depuis l’interface admin ;
- conservation de la source et du contenu adapté ;
- interface admin de validation et d’édition ;
- génération OpenAI contrôlée sur demande humaine ;
- publisher mock ;
- historique d’exécution ;
- première préparation du publisher LinkedIn réel.

La trajectoire actuelle est de passer d’un MVP de jobs éditoriaux à une application produit centrée sur :

```txt
sources → campagnes → IA → validation → publication multi-canal
```

## Structure du dépôt

```txt
.
├── .github/                 # Workflows, templates d’issues et de pull requests
├── AGENTS.md                # Règles de travail pour agents IA
├── docs/                    # Documentation opérationnelle consolidée
├── infra/                   # Configuration d’infrastructure
├── packages/db/             # Schéma et accès à l’état métier
├── packages/shared/         # Types et constantes partagés
├── services/api/            # API et interface admin
├── services/worker/         # Traitements asynchrones, sources et publishers
├── scripts/                 # Scripts de validation locale
├── docker-compose.yml       # Environnement local / staging
├── .env.example             # Variables d’environnement documentées
└── pnpm-lock.yaml           # Lockfile obligatoire
```

## Documentation de référence

La source de vérité opérationnelle est :

```txt
docs/MASTER_PROJECT_TRACKING.md
```

La roadmap détaillée est dans :

```txt
docs/05_ROADMAP.md
```

Les règles de contribution agent IA sont dans :

```txt
AGENTS.md
```

Le dossier `docs/` ne doit pas contenir une note permanente pour chaque PR. Les changements de doctrine, d’architecture, de sécurité, de statuts métier, d’IA, de publisher ou de déploiement doivent être consolidés dans `docs/MASTER_PROJECT_TRACKING.md`. Les documents séparés doivent rester réservés aux runbooks critiques ou aux références stables.

## Licence

RelayPress est placé sous licence **AGPL-3.0-or-later**.

Cette licence est volontairement protectrice pour un projet serveur : si RelayPress est modifié et exploité comme service réseau, les améliorations doivent rester accessibles à la communauté.

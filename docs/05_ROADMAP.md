# Roadmap RelayPress

Cette roadmap doit rester cohérente avec `docs/MASTER_PROJECT_TRACKING.md`, source de vérité opérationnelle synthétique du projet.

RelayPress évolue d’un MVP de jobs éditoriaux vers une application produit complète :

```text
sources éditoriales
→ Signal Engine
→ sélection humaine
→ campagnes multi-formats
→ génération IA contrôlée
→ validation humaine
→ publication multi-canal
→ audit
```

---

## Phases terminées

### Phase 0 — Cadrage conceptuel

Statut : ✅ terminé

- vision RelayPress clarifiée ;
- refus du simple crossposter ;
- Nostr défini comme racine souveraine et journal éditorial ;
- validation humaine identifiée comme garde-fou central.

### Phase 1 — Socle dépôt et CI

Statut : ✅ terminé

- dépôt GitHub créé ;
- licence AGPL-3.0-or-later ;
- monorepo pnpm ;
- Node 24 ;
- TypeScript NodeNext ;
- `pnpm-lock.yaml` obligatoire ;
- CI GitHub Actions ;
- validation Docker Compose.

### Phase 2 — Infrastructure Docker / staging

Statut : ✅ terminé et validé en staging

- stack locale / staging opérationnelle ;
- API, worker, base métier, relay Nostr privé et reverse proxy disponibles ;
- environnement reproductible pour poursuivre les incréments produit.

### Phase 3 — Indexation Nostr

Statut : ✅ terminé et validé runtime

- connexion au relay privé et aux relays publics configurés ;
- filtrage par pubkey autorisée ;
- stockage des événements Nostr ;
- création de jobs depuis commandes `/publish` ou tags dédiés.

### Phase 4 — Jobs de publication

Statut : ✅ terminé pour MVP

- `publication_jobs` créés depuis Nostr ;
- `publication_jobs` créés depuis brouillons manuels ;
- conservation séparée de la source et du contenu adapté ;
- un job par plateforme ;
- statuts métier sécurisés ;
- archivage non destructif.

### Phase 5 — Interface admin MVP

Statut : ✅ terminé pour MVP

- création de brouillon manuel multi-plateforme ;
- comparaison source / contenu adapté ;
- édition humaine avant validation ;
- approbation, rejet, retry, reset-review ;
- visualisation des runs ;
- archivage individuel et groupé.

### Phase 6 — Audit d’exécution

Statut : ✅ terminé pour MVP

- table `publication_job_runs` ;
- un run créé à chaque tentative de publication ;
- statut de run conservé ;
- réponse brute filtrée ou erreur nettoyée conservée pour audit.

### Phase 7 — Couche publisher

Statut : ✅ terminé architecture

- interface commune de publisher ;
- publisher mock ;
- orchestration worker ;
- vérification de disponibilité avant claim ;
- mode mock conservé par défaut ;
- premier incrément LinkedIn réel préparé derrière garde-fous.

### Phase 8 — Nettoyage backlog

Statut : ✅ terminé

- issues ouvertes historiques clôturées ou absorbées ;
- PR documentaire obsolète fermée ;
- backlog prêt pour la trajectoire produit source → IA → publication.

---

## Phase 9 — Cadrage Signal Engine

Statut : 🚧 en cours

Objectif : cadrer le module qui transforme une source Bitcoin sélectionnée en signal éditorial qualifié, puis en campagne multi-format sous validation humaine.

Document de référence :

```text
docs/08_SIGNAL_ENGINE.md
```

Décisions :

- BTC Breakdown sert de radar initial ;
- BTC Breakdown ne doit pas être recopié ou traduit intégralement ;
- Telegram est hors scope comme canal de diffusion ;
- Telegram peut rester une source d’observation humaine, sans connecteur technique initial ;
- les canaux cibles restent Blog, Nostr, LinkedIn, X, Facebook et Instagram ;
- le Signal Engine prépare, l’humain valide, le publisher exécute ;
- aucune publication automatique directe n’est prévue dans le périmètre initial.

Hors périmètre :

- code ;
- migration SQL ;
- dépendance nouvelle ;
- publisher réel ;
- scraping de réseaux sociaux.

---

## Phase A — Sources éditoriales automatisées

Statut : ⏳ prochaine étape produit après cadrage Signal Engine

Objectif : récupérer automatiquement des sources éditoriales exploitables dans l’admin.

Premier provider :

```text
BTC Breakdown
```

Cadence cible initiale :

```text
Toutes les 12 heures, autour de 06:00 et 18:00.
```

Principes :

- commencer par BTC Breakdown uniquement ;
- prévoir un modèle extensible pour d’autres sources plus tard ;
- éviter de multiplier les colonnes de base inutilement ;
- stocker le minimum nécessaire : provider, URL, titre, extrait court, statut, métadonnées, timestamps ;
- afficher les sources récupérées dans l’admin ;
- laisser l’humain sélectionner, ignorer ou archiver une source ;
- ne pas générer de contenu publiable à cette phase.

Hors périmètre initial :

- génération IA ;
- publication ;
- automatisation complète sans validation humaine ;
- ingestion Telegram ;
- scraping de réseaux sociaux.

---

## Phase B — Signaux éditoriaux qualifiés

Statut : ⏳ après Phase A

Objectif : introduire la notion de signal éditorial qualifié sans casser le cœur opérationnel existant.

Le concept cible est décrit dans `docs/08_SIGNAL_ENGINE.md` :

```text
EditorialSignal
```

Un signal doit permettre de conserver :

- la source d’origine ;
- le résumé interne ;
- la catégorie ;
- l’angle souveraineté / Bitcoin ;
- le niveau de risque ;
- les sources primaires ou complémentaires ;
- le statut éditorial.

Cette phase ne doit pas encore générer de campagne automatiquement.

---

## Phase C — Campagnes depuis une source ou un signal

Statut : ⏳ après Phase B

Objectif : créer une campagne éditoriale depuis une source sélectionnée ou un signal qualifié.

Décision : réutiliser `publication_jobs` comme cœur opérationnel et ajouter un rattachement minimal :

```text
publication_jobs.source_item_id
```

Un rattachement futur à un signal pourra être ajouté dans une PR dédiée si le modèle `EditorialSignal` est matérialisé.

L’admin doit permettre de choisir les plateformes :

```text
Blog
Nostr
LinkedIn
X
Facebook
Instagram
```

Chaque plateforme produit un job distinct, rattaché à la source ou au signal.

---

## Phase D — Génération IA contrôlée

Statut : ⏳ après Phase C

Objectif : générer les formats éditoriaux à partir d’une source ou d’un signal sélectionné.

Principe central :

```text
L’IA propose, l’humain valide, le publisher exécute.
```

Formats cibles :

| Canal | Orientation |
|---|---|
| Blog | long, structuré, sourcé, analytique |
| Nostr | court à moyen, souverain, source ou lien Blog |
| LinkedIn | format moyen, ton professionnel, angle business ou gouvernance |
| X | posts courts, angle fort, CTA non obligatoire |
| Facebook | format moyen, accessible grand public |
| Instagram | visuel d’abord, carrousel ou brief visuel, commentaire d’accompagnement |

Squelette Blog :

```text
Titre
Accroche
Contexte
Faits établis
Analyse
Implications Bitcoin / souveraineté
Limites ou incertitudes
Sources
CTA
```

Squelette Nostr / LinkedIn / Facebook :

```text
Accroche
Contexte
Faits importants
Analyse
Source ou lien Blog
CTA final selon canal
```

Exception : X ne reçoit pas de CTA obligatoire, car le format est trop court.

---

## Phase E — Vue admin groupée par source / signal / campagne

Statut : ⏳ après Phase D

Objectif : rendre la campagne lisible et actionnable.

Vue cible :

```text
Source BTC Breakdown
└── Signal qualifié
    ├── Blog
    ├── Nostr
    ├── LinkedIn
    ├── X
    ├── Facebook
    └── Instagram
```

Chaque bloc doit permettre :

- voir la proposition ;
- éditer ;
- régénérer via IA ;
- approuver ;
- publier ;
- copier ou exporter ;
- consulter l’état et l’historique.

---

## Phase F — Publication réelle LinkedIn

Statut : 🚧 à finaliser en premier côté publisher réel

LinkedIn est prioritaire parce que le premier incrément existe déjà.

Objectif : finaliser une publication réelle contrôlée, sans perte de sécurité.

À couvrir dans une issue consolidée :

1. validation de l’admin publishers ;
2. validation OAuth LinkedIn ;
3. test de connexion ;
4. contrôle des informations affichées ;
5. contrôle anti-secret des logs et erreurs ;
6. publication réelle sur compte ou page contrôlée ;
7. vérification des runs ;
8. retour immédiat en mode mock ;
9. note de clôture du test réel.

---

## Phase G — Autres publishers réels

Statut : ⏳ après LinkedIn

Ordre cible :

1. Nostr ;
2. Blog / WordPress ;
3. Facebook ;
4. Instagram ;
5. X.

Principes :

- publication uniquement via API officielle ;
- aucun secret dans le dépôt ;
- tokens chiffrés ;
- validation humaine avant publication réelle ;
- audit systématique.

---

## Phase H — Automatisation avancée

Statut : ⏳ plus tard

Objectif : réduire l’effort humain sans supprimer le contrôle humain.

Trajectoire :

```text
récupération automatique
→ pré-sélection assistée
→ génération IA
→ file de validation humaine
→ publication programmée
```

Publication automatique directe : hors cible initiale.

---

## Phase I — Diagnostics éditoriaux et sécurité Signal Engine

Statut : ⏳ plus tard

Objectif : ajouter des diagnostics inspirés de l’approche `doctor` et `security-audit`, sans reprendre la stack iAgent.

Pistes :

- vérifier que les sources configurées répondent ;
- détecter les URLs invalides ;
- détecter les contenus trop longs recopiés depuis une source ;
- signaler les brouillons sans source ;
- signaler les brouillons avec termes sensibles ;
- confirmer que `PUBLISHER_MODE=mock` reste le défaut sûr ;
- contrôler l’absence de secrets dans les logs et métadonnées.

---

## Phase J — Production durcie

Statut : ⏳ plus tard

- sauvegarde PostgreSQL automatisée ;
- sauvegarde volumes utiles ;
- monitoring conteneurs et disque ;
- alertes ;
- rotation logs ;
- rate limiting ;
- authentification web renforcée ;
- documentation d’exploitation ;
- procédure de restauration.

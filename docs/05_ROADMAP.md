# Roadmap RelayPress

Cette roadmap doit rester cohérente avec `docs/MASTER_PROJECT_TRACKING.md`, source de vérité opérationnelle synthétique du projet.

RelayPress évolue d’un MVP de jobs éditoriaux vers une application produit complète :

```text
sources éditoriales
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

## Phase A — Sources éditoriales automatisées

Statut : ⏳ prochaine étape produit

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
- stocker le minimum nécessaire : provider, URL, titre, contenu, statut, métadonnées, timestamps ;
- afficher les sources récupérées dans l’admin ;
- laisser l’humain sélectionner ou ignorer une source.

Hors périmètre initial :

- génération IA ;
- publication ;
- automatisation complète sans validation humaine.

---

## Phase B — Campagnes depuis une source

Statut : ⏳ après Phase A

Objectif : créer une campagne éditoriale depuis une source sélectionnée.

Décision : réutiliser `publication_jobs` comme cœur opérationnel et ajouter un rattachement minimal :

```text
publication_jobs.source_item_id
```

L’admin doit permettre de choisir les plateformes :

```text
Blog
Nostr
LinkedIn
X
Facebook
Instagram
```

Chaque plateforme produit un job distinct, rattaché à la source.

---

## Phase C — Génération IA contrôlée

Statut : ⏳ après Phase B

Objectif : générer les formats éditoriaux à partir d’une source sélectionnée.

Principe central :

```text
L’IA propose, l’humain valide, le publisher exécute.
```

Formats cibles :

| Canal | Orientation |
|---|---|
| Blog | long, structuré, sourcé, analytique |
| Nostr | structure proche du blog, plus synthétique et souveraine |
| LinkedIn | structure proche du blog, ton professionnel |
| X | posts courts, 140 caractères maximum |
| Facebook | format moyen, accessible grand public |
| Instagram | visuel d’abord, image source ou suggestion visuelle, commentaire d’accompagnement |

Squelette Blog / Nostr / LinkedIn / Facebook :

```text
Accroche
Contexte
Faits importants
Analyse
Sources
CTA final
```

Exception : X ne reçoit pas de CTA obligatoire, car le format est trop court.

---

## Phase D — Vue admin groupée par source

Statut : ⏳ après Phase C

Objectif : rendre la campagne lisible et actionnable.

Vue cible :

```text
Source BTC Breakdown
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

## Phase E — Publication réelle LinkedIn

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

## Phase F — Autres publishers réels

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

## Phase G — Automatisation avancée

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

## Phase H — Production durcie

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

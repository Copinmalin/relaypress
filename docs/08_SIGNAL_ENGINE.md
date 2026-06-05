# Signal Engine RelayPress

Ce document cadre le futur module **Signal Engine** de RelayPress.

Le Signal Engine transforme des sources Bitcoin sélectionnées en signaux éditoriaux exploitables. Il ne publie rien seul. Il prépare la matière, propose des angles et alimente les campagnes multi-formats soumises à validation humaine.

```text
source Bitcoin sélectionnée
→ signal éditorial
→ qualification
→ enrichissement
→ campagne
→ variantes par canal
→ validation humaine
→ publication contrôlée
→ audit
```

---

## 1. Vision

RelayPress ne doit pas devenir un simple crossposter ni un robot de contenu branché sur des plateformes sociales.

Le Signal Engine doit jouer le rôle de salle de rédaction augmentée :

- détecter des sujets Bitcoin pertinents ;
- extraire les faits importants ;
- qualifier l'intérêt éditorial ;
- chercher ou recommander des sources primaires quand c'est possible ;
- produire une base d'analyse francophone originale ;
- décliner cette base dans les formats adaptés aux canaux cibles ;
- laisser l'humain arbitrer, modifier, valider ou rejeter.

Formule cible :

```text
BTC Breakdown détecte.
RelayPress contextualise.
L'humain valide.
Les canaux diffusent.
Nostr conserve la racine souveraine et l'audit éditorial.
```

---

## 2. Canaux cibles

Les canaux de diffusion cibles sont :

| Canal | Rôle | Format cible |
|---|---|---|
| Blog | analyse longue, sourcée, profonde | article structuré |
| Nostr | diffusion souveraine et journal éditorial | court à moyen, direct |
| LinkedIn | communication professionnelle | moyen, business, adoption, souveraineté |
| X | engagement rapide | court, angle fort |
| Facebook | pédagogie grand public | moyen, accessible |
| Instagram | vulgarisation visuelle | visuel, carrousel, légende |

Telegram est explicitement hors scope comme canal de diffusion RelayPress.

Telegram peut rester un canal d'observation humaine : un utilisateur peut y repérer un sujet intéressant, puis créer manuellement un signal dans RelayPress. Il ne doit pas devenir un publisher, un connecteur source prioritaire ou une dépendance d'architecture.

---

## 3. Source initiale : BTC Breakdown

La première source de veille visée est :

```text
BTC Breakdown
https://www.btcbreakdown.com
```

Rôle exact de BTC Breakdown :

- radar Bitcoin-only ;
- point de départ de détection ;
- source de liens, thèmes et signaux ;
- déclencheur de recherche complémentaire.

BTC Breakdown ne doit pas être utilisé comme contenu à republier tel quel.

RelayPress doit éviter :

- la traduction intégrale ;
- la recopie longue ;
- la reformulation automatique sans valeur ajoutée ;
- la publication d'extraits substantiels ;
- la dépendance à une seule source pour les affirmations sensibles.

Usage cible :

```text
item BTC Breakdown
→ résumé court interne
→ extraction du sujet
→ recherche de sources primaires ou complémentaires
→ analyse originale en français
→ variantes par canal
```

---

## 4. Sources acceptées

Sources acceptables pour le Signal Engine :

- BTC Breakdown ;
- sources primaires citées par BTC Breakdown ;
- sites officiels de projets Bitcoin ;
- dépôts GitHub officiels ;
- notes de release ;
- BIPs, NIPs et documents techniques publics ;
- blogs d'experts identifiés ;
- communiqués ou documents institutionnels publics ;
- brouillons manuels saisis dans l'admin ;
- notes Nostr internes ou événements autorisés.

Principe : une source doit être traçable, consultable et assez stable pour alimenter une analyse éditoriale.

---

## 5. Sources exclues ou déconseillées

Sources exclues au démarrage :

- scraping de réseaux sociaux ;
- automatisation de navigateur ;
- récupération de contenus premium non autorisés ;
- canaux Telegram tiers comme source technique automatique ;
- contenus sans URL stable ;
- rumeurs non sourcées ;
- signaux altcoins ou Web3 génériques sans lien Bitcoin direct.

Sources tolérées uniquement comme inspiration humaine :

- messages Telegram observés manuellement ;
- discussions privées ;
- captures d'écran ;
- conversations informelles.

Dans ces cas, RelayPress doit demander ou conserver une source publique exploitable avant génération d'un contenu destiné à publication.

---

## 6. Contraintes copyright et attribution

Le Signal Engine doit produire une analyse originale.

Règles :

- conserver l'URL source ;
- citer BTC Breakdown quand le signal vient de BTC Breakdown ;
- limiter les extraits courts ;
- éviter les longues paraphrases mécaniques ;
- chercher la source primaire quand elle existe ;
- distinguer clairement fait, interprétation et opinion éditoriale ;
- conserver les sources utilisées dans l'objet métier ou dans les métadonnées.

Pour les articles Blog, une section `Sources` doit être prévue.

Pour les formats courts, un lien source ou un lien vers l'article Blog peut suffire selon la plateforme.

---

## 7. Modèle métier : EditorialSignal

Objet conceptuel initial :

```text
EditorialSignal
- id
- source_name
- source_url
- source_title
- detected_at
- original_language
- raw_excerpt_short
- summary_fr
- category
- relevance_score
- bitcoin_only_score
- sovereignty_angle
- risk_level
- primary_sources
- suggested_formats
- status
- created_at
- updated_at
```

Statuts possibles :

```text
new              = signal récupéré ou saisi, non qualifié
qualified        = signal qualifié éditorialement
needs_sources    = source primaire ou complémentaire nécessaire
ready_for_campaign = utilisable pour créer une campagne
ignored          = signal conservé mais non exploité
archived         = signal conservé pour audit, masqué des vues actives
```

Ces statuts sont conceptuels. Leur traduction exacte en base devra rester cohérente avec les statuts existants de `publication_jobs` et l'archivage non destructif.

---

## 8. Catégories éditoriales

Catégories initiales proposées :

```text
self_custody
privacy
opsec
lightning
merchant_adoption
institutional_adoption
mining_energy
regulation
monetary_policy
open_source
education
local_bitcoin
scam_warning
sovereign_tools
nostr
```

Une catégorie doit aider à :

- prioriser le signal ;
- sélectionner les formats ;
- choisir le ton ;
- détecter les risques ;
- construire les revues hebdomadaires.

---

## 9. Workflow cible

```text
1. Récupération ou saisie d'une source
2. Création d'un EditorialSignal
3. Qualification éditoriale
4. Vérification des risques
5. Recherche ou ajout de sources primaires
6. Création d'une campagne depuis le signal
7. Génération de variantes par canal
8. Relecture et édition humaine
9. Validation explicite
10. Publication mock ou réelle selon configuration
11. Audit dans les runs et journal éditorial
```

Aucune publication réelle ne doit partir directement d'un signal.

Le Signal Engine alimente les campagnes. Il ne remplace pas la validation humaine.

---

## 10. Formats éditoriaux par canal

### Blog

Objectif : produire l'analyse de référence.

Structure cible :

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

Le Blog doit être le format le plus sourcé et le plus profond.

### Nostr

Objectif : diffuser le signal dans l'écosystème souverain.

Format :

- direct ;
- court à moyen ;
- orienté Bitcoin ;
- source ou lien Blog quand disponible ;
- peut servir de journal éditorial.

### LinkedIn

Objectif : traduction professionnelle du signal.

Format :

- problématique claire ;
- angle business, risque, adoption ou gouvernance ;
- moins de jargon technique ;
- CTA vers article, formation, atelier ou ressource.

### X

Objectif : engagement rapide.

Format :

- court ;
- angle fort ;
- une idée par post ;
- thread possible plus tard ;
- CTA non obligatoire.

### Facebook

Objectif : vulgarisation grand public.

Format :

- moyen ;
- accessible ;
- pédagogique ;
- ancré dans les usages concrets ;
- CTA simple.

### Instagram

Objectif : signal visuel.

Formats possibles :

```text
carrousel pédagogique
visuel citation
mini-infographie
checklist
résumé en 5 slides
```

Le Signal Engine peut proposer un brief visuel, mais la publication d'image générée ou de visuel destiné au public reste soumise à validation humaine.

---

## 11. Inspiration iAgent

Le dépôt `man-orangepeel/iagent` peut servir d'inspiration conceptuelle, pas de modèle technique à copier.

Concepts utiles :

- `skills` : capacités spécialisées ;
- `projects` : contexte projet ;
- `identity` : doctrine et ton ;
- `tasks` : tâches planifiées ;
- `doctor` : diagnostic de configuration ;
- `security-audit` : vérification des risques ;
- `heartbeat` : contrôle périodique de santé.

À ne pas reprendre dans RelayPress :

- Telegram comme interface centrale ;
- macOS LaunchAgents comme socle d'exécution ;
- Claude CLI comme dépendance obligatoire ;
- agent autonome avec droits trop larges ;
- automatisation de publication non validée.

Adaptation RelayPress possible :

```text
services/worker/src/signal-engine/
  ingest-btcbreakdown.ts
  extract-signals.ts
  enrich-signal.ts
  score-signal.ts
  build-campaign.ts

scripts/
  doctor-signal-engine.ts
  security-audit-editorial.ts
```

Ces chemins sont indicatifs. Toute implémentation doit faire l'objet d'issues et PR séparées.

---

## 12. Sécurité et garde-fous

Le Signal Engine doit respecter les principes du modèle de sécurité RelayPress :

- pas de secret dans le dépôt ;
- pas de scraping de réseaux sociaux ;
- API officielles uniquement pour les publishers réels ;
- `PUBLISHER_MODE=mock` comme défaut sûr ;
- validation humaine obligatoire avant publication réelle ;
- audit des actions importantes ;
- archivage non destructif ;
- pas de republication accidentelle.

Risques spécifiques :

| Risque | Garde-fou |
|---|---|
| Recopie excessive d'une source tierce | citations courtes, analyse originale, source primaire |
| Signal faux ou incomplet | statut `needs_sources`, validation humaine |
| Publication d'une rumeur | catégorie risque, blocage avant campagne |
| Automatisation trop large | BTC Breakdown d'abord, sources ajoutées par PR dédiées |
| Confusion entre brouillon IA et vérité | séparation fait / analyse / opinion |
| Publication réelle accidentelle | mock par défaut, validation humaine, audit |

---

## 13. Roadmap incrémentale

### PR 1 — Documentation Signal Engine

- créer `docs/08_SIGNAL_ENGINE.md` ;
- référencer ce document dans le master tracking ;
- aligner la roadmap ;
- aucune modification de code.

### PR 2 — Modèle source minimal

- ajouter le modèle de stockage des sources récupérées ;
- commencer par BTC Breakdown ;
- stocker URL, titre, extrait court, provider, métadonnées et statut ;
- pas de génération IA.

### PR 3 — Admin sources

- afficher les sources récupérées ;
- permettre d'ignorer, archiver ou sélectionner ;
- préparer la création de campagne.

### PR 4 — Campagne depuis signal

- créer une campagne depuis une source sélectionnée ;
- générer des jobs par canal choisi ;
- rattacher les jobs à la source ou au signal.

### PR 5 — Génération IA contrôlée

- générer des brouillons par canal ;
- conserver les sources ;
- exiger relecture et validation humaine.

### PR 6 — Diagnostics et audit éditorial

- ajouter un diagnostic de configuration source ;
- ajouter un audit éditorial anti-secret, anti-scraping et anti-publication automatique ;
- documenter les vérifications.

---

## 14. Hors périmètre initial

Hors périmètre du cadrage initial :

- publication automatique directe ;
- ingestion Telegram ;
- scraping LinkedIn, X, Facebook, Instagram ou Telegram ;
- génération d'images automatique sans validation ;
- ajout d'un CRM ;
- automatisation de DM ou de commentaires ;
- scoring opaque de personnes ;
- dépendance à une API sociale instable ou non officielle.

---

## 15. Definition of Done du module documentaire

Cette phase documentaire est terminée quand :

- ce document existe ;
- Telegram est explicitement hors scope technique ;
- BTC Breakdown est cadré comme source de veille initiale ;
- les six canaux cibles sont documentés ;
- le workflow signal → campagne → validation est clair ;
- les contraintes copyright et sécurité sont explicites ;
- la roadmap reste atomique ;
- aucun code, secret ou publisher réel n'est ajouté.

# RelayPress - Master Project Tracking

Ce document est la source de verite operationnelle principale du projet RelayPress.

Derniere mise a jour : 2026-06-17

Etat global : MVP editorial souverain fonctionnel en staging. La chaine principale est sources -> signaux editoriaux -> campagnes multi-formats -> generation controlee -> revue humaine -> validation explicite -> publication. La generation OpenAI produit des variantes LinkedIn, X, Facebook et Nostr long-form, toutes conservees en `pending_review`. La PR X0 remplace l interrupteur publisher global par un routage independant par plateforme, sans activer aucun reseau reel.

---

## 1. Doctrine centrale

RelayPress n est pas un crossposter automatique.

```text
source editoriale
-> selection humaine
-> signal editorial
-> jobs par plateforme
-> generation IA controlee
-> relecture et edition humaine
-> validation explicite
-> routage vers le publisher de la plateforme
-> publication mock ou reelle explicitement armee
-> audit des runs
```

Principes non negociables :

- Nostr reste une racine souveraine pour les intentions editoriales et le journal.
- PostgreSQL porte l etat metier operationnel.
- L IA propose et reformate ; l humain valide ; le publisher execute.
- La generation IA ne valide, ne publie et n archive jamais automatiquement.
- Un job publie ou rattache a un `external_post_id` ne doit jamais etre republie accidentellement.
- Chaque plateforme possede son propre mode publisher et son propre verrou de securite.
- Aucun interrupteur generique ne doit armer plusieurs plateformes reelles.
- Aucun secret ne doit etre ajoute au depot ou aux logs.
- Les actions importantes doivent rester auditables.
- Telegram est hors scope comme canal de diffusion RelayPress.
- BTC Breakdown sert de radar initial, pas de contenu a republier tel quel.

---

## 2. Etat courant

| Element | Etat |
|---|---|
| Depot | `Copinmalin/relaypress` |
| Branche principale | `main` |
| Runtime cible | Node 24 |
| Monorepo | pnpm |
| API | Fastify |
| Base metier | PostgreSQL |
| Worker | ingestion, routage publisher et audit |
| Publisher par defaut | mock ou disabled selon plateforme |
| Source automatisee initiale | BTC Breakdown |
| Admin | sources, signaux, jobs, generation IA et campagnes multi-formats |
| IA | OpenAI activable par environnement, fallback mock, sortie structuree |
| Publication reelle | aucune plateforme activee dans PR X0 |

---

## 3. Architecture logique

```text
SourceItem
  source recuperee, auditee, selectionnable

EditorialSignal
  lecture humaine d une source ou intention editoriale qualifiee

PublicationJob
  brouillon operationnel par plateforme

Generation controlee
  reecrit adapted_content sans validation ni publication

Campagne multi-format
  cree plusieurs PublicationJob depuis un meme signal
  conserve chaque variante en pending_review

PublisherRouter
  lit la plateforme du job approuve
  selectionne le publisher correspondant
  verifie la readiness avant claim
  ne route jamais une plateforme disabled ou real non implementee

Publisher
  mock, disabled ou real selon la plateforme
```

---

## 4. Statuts metier

### SourceItem

```text
new
selected
ignored
archived
failed
```

### EditorialSignal

```text
qualified
needs_sources
ready_for_campaign
ignored
archived
```

### PublicationJob

```text
pending
pending_review
drafted
approved
publishing
published
rejected
failed
archived
```

Regles essentielles :

- La generation est limitee aux jobs non publies `pending_review` et `drafted`.
- Elle conserve `source_content` et reecrit uniquement `adapted_content`.
- Elle ne passe jamais automatiquement le job en `approved`.
- Une campagne cree les jobs en `pending_review` et tolere un echec partiel.
- La publication concerne uniquement les jobs `approved`, sans `external_post_id` ni `published_at`.
- Un publisher doit etre pret avant que le worker ne claim ses jobs.
- Un job approuve sur une plateforme `disabled` ou `real` non disponible reste approuve.

---

## 5. Generation IA controlee

Configuration attendue hors depot :

```text
AI_PROVIDER=openai
OPENAI_API_KEY=<secret hors depot>
OPENAI_MODEL=gpt-5.5
```

Regles :

- Si la cle OpenAI est absente, la generation retombe en mock.
- Le parametre `temperature` n est pas envoye.
- Le profil par defaut vise B-Conseil by Copinmalin.
- La generation utilise uniquement les sources fournies.
- Les chiffres absents de la source ne doivent pas etre inventes.
- Les extrapolations utiles vont dans `claims_requiring_human_review`.
- La sortie cible un JSON strict contenant notamment `final_text`, `facts_used`, `claims_requiring_human_review`, `source_url`, `format`, `tone` et `warnings`.

Route campagne multi-format :

```text
POST /editorial-signals/:id/generate-campaign
```

Plateformes par defaut :

```text
linkedin
x
facebook
nostr_longform
```

Formats :

| Plateforme | Format |
|---|---|
| LinkedIn | 1300 a 2000 caracteres, publication directe et CTA contextualise |
| X | 140 caracteres maximum imperatif |
| Facebook | 900 a 1500 caracteres, pedagogique et accessible |
| Nostr long-form | article complet de plus de 1500 caracteres avec plan visible |
| Instagram | futur couple image + texte Meta Business |

---

## 6. Routage multi-publishers

PR X0 introduit une configuration independante par plateforme :

```env
LINKEDIN_PUBLISHER_MODE=mock
X_PUBLISHER_MODE=mock
FACEBOOK_PUBLISHER_MODE=mock
INSTAGRAM_PUBLISHER_MODE=disabled
NOSTR_PUBLISHER_MODE=mock
```

Modes acceptes :

```text
disabled
mock
real
```

Comportement :

- `disabled` : aucun publisher et aucun claim ;
- `mock` : publisher dedie a une seule plateforme, publication simulee et auditee ;
- `real` : route non prete dans PR X0, meme si le safety ack est present ;
- le batch publisher reste global au tick worker ;
- le worker route chaque job uniquement vers le publisher de sa plateforme ;
- `nostr_longform` est supporte en mock ;
- aucun appel reseau reel n est effectue dans PR X0.

Safety acknowledgements separes :

```env
LINKEDIN_REAL_SAFETY_ACK=
X_REAL_SAFETY_ACK=
META_REAL_SAFETY_ACK=
NOSTR_REAL_SAFETY_ACK=
```

`PUBLISHER_MODE` reste accepte comme compatibilite transitoire et produit un avertissement de deprecation. Il doit etre retire apres migration complete vers les variables par plateforme.

---

## 7. Publication et publishers reels

Ordre recommande :

```text
X1 LinkedIn reel
X2 Nostr long-form reel
X3 Facebook / Meta reel
X4 X reel
X5 Instagram media
```

Chaque PR reelle devra apporter :

- API officielle uniquement ;
- OAuth ou signer externe adapte ;
- stockage chiffre des credentials ;
- scopes minimaux documentes ;
- readiness avant claim ;
- safety ack dedie ;
- test limite a un seul job ;
- rollback immediat vers mock ;
- audit nettoye sans token dans `raw_response`.

Nostr reel ne doit jamais stocker un `nsec` principal en clair. La cible reste un signer externe, notamment NIP-46.

---

## 8. Revue admin

La page `/admin` doit privilegier la lecture editoriale :

```text
origine commune
-> resultat LinkedIn
-> resultat X
-> resultat Facebook
-> resultat Nostr long-form
```

Les details techniques, IDs et runs restent disponibles dans des panneaux replies. Les decisions restent individuelles par job.

PR W porte cette simplification dans une branche separee de PR X0.

---

## 9. Documents actifs faisant autorite

| Document | Role |
|---|---|
| `docs/MASTER_PROJECT_TRACKING.md` | source de verite principale |
| `docs/03_SECURITY_MODEL.md` | securite, secrets, OAuth et publishers |
| `docs/04_DEPLOYMENT_CADDY_DOCKER.md` | deploiement Caddy / Docker |
| `docs/05_ROADMAP.md` | trajectoire produit |
| `docs/06_CI_NOTES.md` | CI, Node, pnpm et checks |
| `docs/08_SIGNAL_ENGINE.md` | moteur de signaux |
| `docs/LINKEDIN_REAL_TEST_RUNBOOK.md` | test LinkedIn reel et rollback |

Ne pas creer un document de phase pour chaque PR. Consolider ici les changements structurants.

---

## 10. Historique synthetique

```text
PR A1 - Schema SourceItem : implemente
PR A2 - Ingestion BTC Breakdown : implemente
PR A3 - Admin sources : implemente
PR B a G - Signaux, jobs et vue groupee : implementes
PR H / I - Generation IA controlee : implementee
PR J - LinkedIn reel controle : a reprendre dans X1
PR U - Prompts B-Conseil source-grounded : implemente
PR V - Campagne LinkedIn / X / Facebook / Nostr long-form : implemente
PR W - Revue admin campagne simplifiee : en cours, branche separee
PR X0 - Routage multi-publishers et safety controls : en cours
```

---

## 11. Risques actifs

| Risque | Controle |
|---|---|
| Publication reelle accidentelle | Modes par plateforme, mock / disabled par defaut, real bloque dans X0 |
| Un safety ack arme plusieurs reseaux | Ack separe pour LinkedIn, X, Meta et Nostr |
| Job claim avant readiness | Readiness verifiee avant la requete de claim |
| Plateforme desactivee publiee | Aucun publisher en mode disabled |
| Mode real non implemente | Publisher placeholder non pret, aucun claim |
| Republication accidentelle | Job approuve, sans external ID ni published_at seulement |
| Depassement X | Adaptateur borne a 140 caracteres |
| Invention IA | Prompt source-grounded, facts_used et revue humaine |
| Secret dans les logs | Logs nettoyes, aucun token ou ack journalise |
| Etat DB concurrent | Migrations serialisees par advisory lock PostgreSQL |

---

## 12. Smoke tests

### PR V

Valide quatre variantes depuis un meme signal, toutes en `pending_review`, sans publication automatique.

### PR X0

Le smoke test doit confirmer :

- LinkedIn, X, Facebook et Nostr long-form en mock ;
- Instagram en disabled ;
- un mock publisher scope a une seule plateforme ;
- chaque mock publisher est ready ;
- un mode LinkedIn `real`, meme avec safety ack valide, reste non ready dans PR X0 ;
- aucun appel reseau reel ;
- sortie `PR_X0_ROUTING_SMOKE=OK`.

---

## 13. Backlog court

1. Valider et fusionner PR W.
2. Valider PR X0 en staging.
3. Implementer X1 LinkedIn reel avec runbook et test unitaire de publication.
4. Implementer X2 Nostr long-form avec signer externe.
5. Implementer Meta, X puis Instagram dans des PR distinctes.

# RelayPress - Master Project Tracking

Ce document est la source de verite operationnelle principale du projet RelayPress.

Derniere mise a jour : 2026-06-17

Etat global : MVP editorial souverain fonctionnel en staging. RelayPress transforme des sources selectionnees en signaux editoriaux, puis en campagnes LinkedIn, X, Facebook et Nostr long-form. La generation OpenAI reste source-grounded, structuree et soumise a revue humaine. Le routage publisher est explicite par plateforme. PR X1 ajoute une publication LinkedIn reelle strictement controlee, ciblee sur un compte OAuth chiffre et un seul job allowliste. Tous les autres publishers reels restent bloques.

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
-> publisher configure pour la plateforme
-> audit des runs
```

Principes non negociables :

- Nostr reste une racine souveraine pour les intentions editoriales et le journal.
- PostgreSQL porte l etat metier operationnel.
- L IA propose et reformate ; l humain valide ; le publisher execute.
- La generation IA ne valide, ne publie et n archive jamais automatiquement.
- Un job publie ou rattache a un `external_post_id` ne doit jamais etre regenere ou republie accidentellement.
- Les publishers reels exigent un armement explicite, propre a chaque plateforme.
- LinkedIn reel exige en plus un compte exact et un job exact allowliste.
- Aucun secret ne doit etre ajoute au depot ou affiche dans les logs.
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
| Worker | ingestion, routage publisher et execution asynchrone |
| Source automatisee initiale | BTC Breakdown |
| Admin | sources, signaux, jobs, generation et campagnes multi-formats |
| IA | OpenAI activable, fallback mock, sortie JSON stricte |
| Routage publishers | registry par plateforme |
| LinkedIn | mock par defaut, real controle dans PR X1 |
| X | mock ou disabled |
| Facebook | mock ou disabled |
| Instagram | disabled par defaut |
| Nostr long-form | mock ou disabled |

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
  cree LinkedIn, X, Facebook et Nostr long-form depuis un meme signal
  conserve chaque variante en pending_review

Publisher router
  lit job.platform
  choisit le publisher configure pour cette plateforme
  ne reclame que les plateformes ready

Publisher mock
  simule publication et audit

Publisher LinkedIn reel PR X1
  verifie mode, safety ack, compte exact, scope, token et job exact
  publie via LinkedIn Posts API versionnee
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

Regles :

- la generation est limitee aux jobs `pending_review` et `drafted` ;
- elle conserve `source_content` et reecrit seulement `adapted_content` ;
- apres generation, le job reste soumis a une decision humaine ;
- seul un job `approved`, non publie et sans `external_post_id` peut etre reclame par le worker ;
- une plateforme disabled ne doit pas etre reclamee ;
- LinkedIn reel ne reclame que `LINKEDIN_REAL_ALLOWED_JOB_ID` ;
- tous les autres jobs LinkedIn approuves restent intacts ;
- X, Facebook, Instagram et Nostr real restent bloques.

---

## 5. Generation multi-format

Route principale :

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

Formats cibles :

| Plateforme | Format |
|---|---|
| LinkedIn | 1300 a 2000 caracteres, publication directe B-Conseil |
| X | 140 caracteres maximum, limite deterministe |
| Facebook | 900 a 1500 caracteres, pedagogique grand public |
| Nostr long-form | article complet de plus de 1500 caracteres, plan visible |
| Instagram | hors scope court terme, media requis |

Garde-fous :

- aucune approbation automatique ;
- aucune publication automatique ;
- aucun archivage automatique ;
- resultat detaille par plateforme ;
- succes partiel possible ;
- relecture humaine obligatoire.

---

## 6. Routage publishers

Registry :

```text
linkedin       -> publisher LinkedIn configure
x              -> publisher X configure
facebook       -> publisher Facebook configure
instagram      -> publisher Instagram configure
nostr_longform -> publisher Nostr configure
```

Configuration sure par defaut :

```text
LINKEDIN_PUBLISHER_MODE=mock
X_PUBLISHER_MODE=mock
FACEBOOK_PUBLISHER_MODE=mock
INSTAGRAM_PUBLISHER_MODE=disabled
NOSTR_PUBLISHER_MODE=mock
```

Le parametre historique `PUBLISHER_MODE` est conserve uniquement pour visibilite de migration. Il ne peut pas armer une publication reelle.

### Modes reels

PR X1 autorise `real` uniquement pour LinkedIn.

Pour X, Facebook, Instagram et Nostr :

```text
requestedMode=real
-> effectiveMode=disabled
-> reason=real_publisher_not_enabled_in_pr_x0
```

---

## 7. LinkedIn reel controle PR X1

Armement obligatoire :

```text
LINKEDIN_PUBLISHER_MODE=real
LINKEDIN_REAL_SAFETY_ACK=I_UNDERSTAND_LINKEDIN_REAL_PUBLICATION
LINKEDIN_PUBLISHER_ACCOUNT_ID=<id interne exact>
LINKEDIN_REAL_ALLOWED_JOB_ID=<id exact du job approuve>
```

Sans l un de ces elements :

```text
effectiveMode=disabled
aucun claim
aucun appel LinkedIn
```

### Compte et credentials

Le compte reel provient uniquement de `publisher_accounts` :

```text
provider=linkedin
status=connected
account_urn=urn:li:person:...
scopes contient w_member_social
access token chiffre et non expire
userinfo.sub correspond a account_urn
```

Les variables historiques :

```text
LINKEDIN_ACCESS_TOKEN
LINKEDIN_AUTHOR_URN
```

ne sont pas utilisees pour le publisher reel PR X1.

### API officielle

```text
POST https://api.linkedin.com/rest/posts
Linkedin-Version: 202606
X-Restli-Protocol-Version: 2.0.0
```

Payload texte :

```text
author
commentary
visibility=PUBLIC
distribution.feedDistribution=MAIN_FEED
lifecycleState=PUBLISHED
isReshareDisabledByAuthor=false
```

La reponse attendue est `201` avec `x-restli-id`.

### Limite de publication

Le publisher LinkedIn reel :

- est limite a un job par tick ;
- reclame uniquement l ID allowliste ;
- refuse aussi dans `publish()` tout autre ID ;
- laisse les autres jobs `approved` ;
- cree un run `mode=real` ;
- ne journalise aucun token.

### Reponse sans identifiant

Si LinkedIn retourne 201 sans `x-restli-id` :

```text
postMayHaveBeenCreated=true
```

Ne pas utiliser Retry avant reconciliation humaine sur LinkedIn.

---

## 8. Orchestrateur worker

A chaque tick :

1. construire le registry des publishers ;
2. verifier `isReady()` pour chaque plateforme ;
3. journaliser les plateformes bloquees sans secret ;
4. appliquer les contraintes propres au publisher ;
5. reclamer uniquement les jobs approuves eligibles ;
6. router chaque job vers son publisher ;
7. creer un `publication_job_run` ;
8. enregistrer succes ou echec ;
9. conserver l anti-republication existante.

Le batch global reste :

```text
PUBLISHER_BATCH_SIZE=10
```

Le publisher LinkedIn reel impose sa propre limite :

```text
maxJobsPerTick=1
```

---

## 9. Connexions futures

Ordre prevu :

```text
PR X0 routeur multi-publishers : implemente
-> PR X1 LinkedIn reel : en cours
-> PR X2 Nostr long-form reel
-> PR X3 Facebook / Meta
-> PR X4 X
-> PR X5 Instagram et media
```

Chaque PR reelle doit ajouter :

- OAuth ou signer adapte ;
- stockage chiffre des credentials ;
- readiness check ;
- safety ack propre a la plateforme ;
- selection explicite du compte ;
- test limite et controle ;
- rollback vers mock ou disabled ;
- audit sans secret.

---

## 10. Documents actifs faisant autorite

| Document | Role |
|---|---|
| `docs/MASTER_PROJECT_TRACKING.md` | source de verite principale |
| `docs/03_SECURITY_MODEL.md` | securite, secrets, OAuth et logs |
| `docs/04_DEPLOYMENT_CADDY_DOCKER.md` | deploiement Caddy / Docker |
| `docs/05_ROADMAP.md` | trajectoire produit |
| `docs/06_CI_NOTES.md` | CI, Node et pnpm |
| `docs/08_SIGNAL_ENGINE.md` | moteur de signaux |
| `docs/LINKEDIN_REAL_TEST_RUNBOOK.md` | test LinkedIn reel et rollback |

Ne pas creer un document de phase par PR. Mettre a jour ce Master pour les changements d architecture, de securite, de generation ou de publication.

---

## 11. Historique synthetique

```text
PR A1 a A3 - Sources : implemente
PR B a G - Signaux et jobs : implemente
PR H et I - Generation controlee : implemente
PR U - Profil B-Conseil source-grounded : implemente
PR V - Campagne LinkedIn / X / Facebook / Nostr long-form : implemente
PR W - Revue admin campagne simplifiee : en cours
PR X0 - Routage multi-publishers et verrous par plateforme : implemente
PR X1 - LinkedIn reel controle via Posts API : en cours
```

---

## 12. Risques actifs

| Risque | Controle |
|---|---|
| Publication LinkedIn reelle accidentelle | quatre verrous runtime simultanes |
| Mauvais compte LinkedIn | account ID exact et userinfo subject match |
| Plusieurs jobs LinkedIn approuves | allowlist d un seul job et limite un par tick |
| Token expire ou invalide | readiness avant claim, refresh si disponible, OAuth sinon |
| Scope insuffisant | `w_member_social` obligatoire |
| Mauvaise version API | `LINKEDIN_API_VERSION=202606` explicite |
| Reponse 201 sans ID | pas de retry automatique, reconciliation humaine |
| Valeur real sur autre plateforme | conversion en disabled |
| Legacy `PUBLISHER_MODE=linkedin_real` | variable ignoree pour le routage effectif |
| Republication accidentelle | statut approved, external id null et published_at null requis |
| Secret dans les logs | aucun token, refresh token, client secret ou safety ack |
| Invention IA | prompt source-grounded et revue humaine |

---

## 13. Smoke tests

### PR V

Valide : quatre formats generes, zero echec, tous laisses en `pending_review` avant decision humaine.

### PR X0

Valide : quatre plateformes mock routees, Instagram disabled, real bloque sur les plateformes non supportees.

### PR X1

Script :

```text
scripts/smoke-pr-x1-linkedin-real.sh
```

Il doit verifier sans appel LinkedIn reel :

- safety ack invalide bloque ;
- account ID manquant bloque ;
- allowed job ID manquant bloque ;
- fake `userinfo` valide le compte exact ;
- fake `POST /posts` recoit les headers et le payload officiels ;
- exactement un job allowliste est publie ;
- un job LinkedIn decoy reste `approved` ;
- run `mode=real` cree ;
- token absent des runs et logs ;
- fixtures archivees et compte de test supprime ;
- worker normal redemarre.

Le test LinkedIn reel public reste une operation separee, soumise au runbook et a un feu vert explicite.

---

## 14. Backlog court

1. Valider PR W en staging puis fusionner.
2. Valider PR X1 avec checks et smoke simule.
3. Effectuer un test LinkedIn reel sur un seul job apres feu vert separe.
4. Restaurer mock et documenter le test.
5. Implementer PR X2 Nostr long-form avec signer distant.

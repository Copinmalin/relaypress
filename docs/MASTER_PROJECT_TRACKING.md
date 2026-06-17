# RelayPress - Master Project Tracking

Ce document est la source de verite operationnelle principale du projet RelayPress.

Derniere mise a jour : 2026-06-17

Etat global : MVP editorial souverain fonctionnel en staging. RelayPress transforme des sources selectionnees en signaux editoriaux, puis en campagnes LinkedIn, X, Facebook et Nostr long-form. La generation OpenAI reste source-grounded, structuree et soumise a revue humaine. PR X0 remplace le mode publisher global par un routage explicite par plateforme, uniquement en mock ou disabled. Aucun reseau reel ne peut etre active dans cette phase.

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
| Publishers PR X0 | routage par plateforme, modes `mock` ou `disabled` seulement |
| Publication reelle | aucune activation reelle dans PR X0 |

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

Publisher
  mock ou disabled dans PR X0
  reel uniquement dans une PR dediee ulterieure
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
- une plateforme real non supportee dans X0 reste bloquee et son job reste `approved`.

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

## 6. Routage publishers PR X0

PR X0 introduit un registry :

```text
linkedin       -> publisher LinkedIn configure
x              -> publisher X configure
facebook       -> publisher Facebook configure
instagram      -> publisher Instagram configure
nostr_longform -> publisher Nostr configure
```

Configuration :

```text
LINKEDIN_PUBLISHER_MODE=mock
X_PUBLISHER_MODE=mock
FACEBOOK_PUBLISHER_MODE=mock
INSTAGRAM_PUBLISHER_MODE=disabled
NOSTR_PUBLISHER_MODE=mock
```

Modes supportes dans X0 :

```text
mock
disabled
```

Toute valeur `real` ou inconnue produit :

```text
requestedMode = valeur demandee
effectiveMode = disabled
reason = explicite dans les logs
```

Le parametre historique `PUBLISHER_MODE` est conserve uniquement pour visibilite de migration. Il ne peut plus armer une publication reelle.

Futurs verrous par plateforme :

```text
LINKEDIN_REAL_SAFETY_ACK
X_REAL_SAFETY_ACK
META_REAL_SAFETY_ACK
NOSTR_REAL_SAFETY_ACK
```

Dans X0, la presence de ces valeurs est seulement signalee comme booleen dans le plan de routage. Leur contenu n est jamais logge et aucune activation reelle n en resulte.

---

## 7. Orchestrateur worker

A chaque tick :

1. construire le registry des publishers ;
2. verifier `isReady()` pour chaque plateforme ;
3. journaliser les plateformes bloquees sans secret ;
4. reclamer uniquement les jobs approuves des plateformes ready ;
5. router chaque job vers son publisher ;
6. creer un `publication_job_run` ;
7. enregistrer succes ou echec ;
8. conserver l anti-republication existante.

Le batch reste global dans cette phase :

```text
PUBLISHER_BATCH_SIZE=10
```

---

## 8. Publication et connexions futures

Aucun appel reel LinkedIn, X, Meta ou Nostr n est effectue dans PR X0.

Ordre prevu :

```text
PR X0 routeur multi-publishers
-> PR X1 LinkedIn reel
-> PR X2 Nostr long-form reel
-> PR X3 Facebook / Meta
-> PR X4 X
-> PR X5 Instagram et media
```

Chaque PR reelle devra ajouter :

- OAuth ou signer adapte ;
- stockage chiffre des credentials ;
- readiness check ;
- safety ack propre a la plateforme ;
- test limite a un job ;
- rollback vers mock ou disabled ;
- audit sans secret.

---

## 9. Documents actifs faisant autorite

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

## 10. Historique synthetique

```text
PR A1 a A3 - Sources : implemente
PR B a G - Signaux et jobs : implemente
PR H et I - Generation controlee : implemente
PR U - Profil B-Conseil source-grounded : implemente
PR V - Campagne LinkedIn / X / Facebook / Nostr long-form : implemente
PR W - Revue admin campagne simplifiee : en cours
PR X0 - Routage multi-publishers et verrous par plateforme : en cours
PR J / X1 - LinkedIn reel controle : a reprendre apres X0
```

---

## 11. Risques actifs

| Risque | Controle |
|---|---|
| Publication reelle accidentelle | X0 n expose que `mock` et `disabled` |
| Valeur `real` dans l environnement | conversion en disabled avec raison explicite |
| Legacy `PUBLISHER_MODE=linkedin_real` | variable ignoree pour le routage effectif |
| Plateforme disabled reclamee | seules les plateformes ready entrent dans la requete de claim |
| Republication accidentelle | statut approved, external id null et published_at null requis |
| Secret dans les logs | plan de routage sans valeur de token ni contenu de safety ack |
| Echec d un publisher | run et job marques failed sans toucher aux autres jobs |
| Invention IA | prompt source-grounded, facts used, claims a verifier et revue humaine |
| Depassement X | adaptation bornee a 140 caracteres |
| Nostr sans publisher reel | mock ou disabled seulement dans X0 |

---

## 12. Smoke tests

### PR V

Valide : quatre formats generes, zero echec, tous laisses en `pending_review` avant decision humaine.

### PR X0

Script :

```text
scripts/smoke-pr-x0-publisher-routing.sh
```

Doit verifier :

- LinkedIn, X, Facebook et Nostr long-form mock traites dans un meme run ;
- Instagram disabled reste `approved` ;
- external IDs mock prefixes par plateforme ;
- `PUBLISHER_MODE=linkedin_real` legacy n active rien de reel ;
- `X_PUBLISHER_MODE=real` est bloque ;
- le job X bloque reste `approved` sans external id ;
- les jobs de test sont archives en nettoyage ;
- le worker normal est redemarre.

---

## 13. Backlog court

1. Valider PR W en staging puis fusionner.
2. Valider PR X0 avec checks et smoke multi-publishers.
3. Implementer PR X1 LinkedIn reel sur le routeur X0.
4. Implementer PR X2 Nostr long-form avec signer distant.
5. Preparer Meta puis X et Instagram.

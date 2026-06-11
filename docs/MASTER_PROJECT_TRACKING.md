# RelayPress - Master Project Tracking

Ce document est la source de verite operationnelle principale du projet RelayPress.

Derniere mise a jour : 2026-06-10

Etat global : MVP editorial souverain fonctionnel en staging. RelayPress orchestre des sources editoriales vers des contenus multi-canaux, avec generation IA controlee, validation humaine, publication mock par defaut et audit. Le dossier `docs/` doit rester une aide operationnelle, pas une archive exhaustive de chaque PR.

---

## 1. Doctrine centrale

RelayPress n est pas un crossposter automatique.

La chaine cible est :

```text
source editoriale
-> selection humaine
-> signal editorial
-> jobs par plateforme
-> generation IA controlee
-> relecture et edition humaine
-> validation explicite
-> publication mock ou publisher reel explicitement arme
-> audit des runs
```

Principes non negociables :

- Nostr reste une racine souveraine pour les intentions editoriales et le journal.
- PostgreSQL porte l etat metier operationnel.
- L IA propose et reformate ; l humain valide ; le publisher execute.
- La generation IA ne valide jamais un job.
- La generation IA ne publie jamais.
- Un job publie ou rattache a un `external_post_id` ne doit jamais etre regenere ou republie accidentellement.
- `PUBLISHER_MODE=mock` reste le defaut sur tant que les publishers reels ne sont pas durcis.
- LinkedIn reel exige un double opt-in runtime avant usage.
- Aucun secret ne doit etre ajoute au depot.
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
| Worker | orchestration asynchrone et publishers |
| Publisher actif par defaut | mock |
| Source automatisee initiale | BTC Breakdown |
| Admin | sources, signaux, jobs, vue groupee, generation IA controlee |
| IA | OpenAI activable par environnement, fallback mock |
| Publication reelle | preparee pour LinkedIn, non activee par defaut |

---

## 3. Architecture logique

```text
SourceItem
  source recuperee, auditee, selectionnable

EditorialSignal
  lecture humaine d une source ou intention editoriale qualifiee

PublicationJob
  brouillon operationnel par plateforme, editable, validable humainement

Generation controlee
  reecrit adapted_content sur demande admin, sans validation ni publication

Worker
  traite les jobs approuves et execute le publisher configure

Publisher
  mock par defaut ; reel uniquement si explicitement arme et documente
```

---

## 4. Statuts metier actifs

### SourceItem

```text
new
selected
ignored
archived
failed
```

Ces statuts ne declenchent aucune publication.

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

- La generation controlee est limitee aux jobs `pending_review` et `drafted`.
- Elle conserve `source_content`.
- Elle reecrit uniquement `adapted_content`.
- Elle ne change pas le statut en `approved`.
- Elle ne publie rien.
- La publication reelle reste limitee aux jobs explicitement `approved`, traites par le worker selon le publisher arme.

---

## 5. Generation IA controlee

Configuration attendue en environnement, hors depot :

```text
AI_PROVIDER=openai
OPENAI_API_KEY=<secret hors depot>
OPENAI_MODEL=gpt-5.5
```

Regles :

- Si `AI_PROVIDER=openai` et `OPENAI_API_KEY` sont presents, `/publication-jobs/:id/generate` utilise OpenAI.
- Si la cle est absente, la generation retombe en mock.
- `OPENAI_MODEL` pilote le modele utilise.
- La sortie OpenAI est extraite de maniere robuste depuis `output_text` ou `output[].content[]`.
- Le parametre `temperature` n est pas envoye, car certains modeles ne le supportent pas.
- `PUBLISHER_MODE=mock` ne bloque pas la generation IA ; il bloque seulement la diffusion reelle.

Separation critique :

```text
AI_PROVIDER=openai   = generation / mise en forme editoriale
PUBLISHER_MODE=mock = aucune diffusion reelle vers les reseaux
```

---

## 6. Publication et publishers

Etat actuel :

- Le publisher mock reste le comportement par defaut.
- LinkedIn reel dispose de garde-fous et d un runbook, mais ne doit etre arme que pendant un test controle.
- Les autres publishers reels restent hors execution tant que leur securite, OAuth, rollback et audit ne sont pas finalises.

Variables sensibles ou critiques :

```text
ADMIN_API_TOKEN
TOKEN_ENCRYPTION_KEY
SESSION_SECRET
OPENAI_API_KEY
LINKEDIN_ACCESS_TOKEN
LINKEDIN_AUTHOR_URN
LINKEDIN_CLIENT_SECRET
PUBLISHER_REAL_SAFETY_ACK
```

Aucune de ces valeurs ne doit etre committee, affichee dans les logs ou partagee dans une PR.

---

## 7. Documents actifs faisant autorite

Le dossier `docs/` doit rester court. Les docs actives sont :

| Document | Role |
|---|---|
| `docs/MASTER_PROJECT_TRACKING.md` | source de verite principale, etat courant, doctrine, risques, backlog |
| `docs/03_SECURITY_MODEL.md` | securite, secrets, OAuth, logs, publication reelle |
| `docs/04_DEPLOYMENT_CADDY_DOCKER.md` | notes de deploiement Caddy / Docker |
| `docs/05_ROADMAP.md` | trajectoire produit et priorites |
| `docs/06_CI_NOTES.md` | CI, Node, pnpm, checks |
| `docs/08_SIGNAL_ENGINE.md` | cadrage conceptuel du moteur de signaux |
| `docs/LINKEDIN_REAL_TEST_RUNBOOK.md` | procedure critique de test LinkedIn reel et rollback mock |

Les anciens fichiers de phase ou de PR ne doivent plus faire autorite une fois leur contenu consolide ici. L historique detaille reste dans Git et dans les PR GitHub.

---

## 8. Historique synthetique des phases

### Phase A - Sources

- Modele `SourceItem` ajoute.
- Ingestion minimale BTC Breakdown ajoutee.
- Admin des sources recuperees ajoute.
- Les sources ne declenchent aucune publication.

### Phase B - Signaux editoriaux

- Modele `EditorialSignal` ajoute.
- Qualification humaine d une source selectionnee vers signal editorial.
- Admin des signaux ajoute.
- Le signal reste une intention editoriale, pas un ordre de publication automatique.

### Phase C - Jobs et preparation multi-plateforme

- Creation explicite de jobs depuis un signal pret.
- Selection humaine des plateformes.
- Action admin de preparation de jobs.
- Vue groupee source / signal / jobs.
- Aucun job n est publie sans validation.

### Phase D - Generation IA controlee

- Endpoint `/publication-jobs/:id/generate` ajoute.
- Bouton admin `Generer / reecrire` ajoute.
- OpenAI activable par environnement.
- Parsing de sortie Responses API rendu robuste.
- La generation modifie `adapted_content`, sans validation et sans publication.

### Phase E - Publishers et LinkedIn reel

- Publisher mock operationnel et par defaut.
- LinkedIn reel prepare avec double opt-in runtime.
- Runbook de test et rollback mock documente.
- Aucun publisher reel ne doit etre arme hors fenetre de test controlee.

### Phase F - Qualite, staging et documentation

- CI et checks documentes.
- Smoke readiness staging documentee.
- Documentation consolidee autour du Master Project Tracking.
- Les notes de PR ne doivent plus devenir des documents actifs permanents.

---

## 9. Risques actifs

| Risque | Controle |
|---|---|
| Publication reelle accidentelle | `PUBLISHER_MODE=mock` par defaut, double opt-in LinkedIn reel |
| Generation IA publiee sans validation | generation limitee a `adapted_content`, sans changement de statut |
| Secret dans le depot ou logs | interdiction explicite, `.env` reel hors depot |
| Republier un job deja publie | blocage sur `external_post_id` et `published_at` |
| Confusion mock generation / mock publication | doctrine separee : `AI_PROVIDER` pour generation, `PUBLISHER_MODE` pour diffusion |
| Documentation contradictoire | Master unique comme source de verite, anciennes docs PR non autoritatives |

---

## 10. Regle documentaire

A compter de cette consolidation :

- Ne pas creer un fichier `docs/XX_PR_...` pour chaque PR.
- Mettre a jour ce Master si une PR change la doctrine, l architecture, les statuts, la securite, le publisher, la generation IA ou le deploiement.
- Creer un document separe uniquement pour un runbook critique ou une reference stable.
- Supprimer ou archiver les notes de PR une fois leur contenu consolide.
- Ne jamais dupliquer une verite operationnelle dans plusieurs fichiers actifs.

---

## 11. Backlog court recommande

1. Terminer la consolidation documentaire et supprimer les notes PR obsoletes.
2. Relancer un smoke test staging : source -> signal -> jobs -> generation OpenAI -> edition -> validation mock.
3. Preparer un test LinkedIn reel limite a un seul job, uniquement avec le runbook et rollback prets.
4. Revoir l ergonomie admin de generation OpenAI : affichage clair du mode utilise et du modele.
5. Stabiliser la doctrine des campagnes editoriales avant d ajouter de nouveaux publishers reels.

# RelayPress - Master Project Tracking

Ce document est la source de verite operationnelle synthetique du projet RelayPress.

Derniere mise a jour : 2026-06-07

Etat global : MVP editorial souverain fonctionnel en staging. La trajectoire produit est recentree sur sources -> signaux editoriaux -> preparation explicite de jobs -> IA controlee -> validation -> publication multi-canal. PR F ajoute l action admin permettant de preparer des publication_jobs depuis un EditorialSignal ready_for_campaign, sans IA et sans publication automatique.

---

## 1. Resume executif

RelayPress est une application d orchestration editoriale souveraine.

Le coeur du systeme est la separation nette entre :

```text
SourceItem = source recuperee et auditee
EditorialSignal = lecture editoriale humaine d une source
PublicationJob = brouillon operationnel par plateforme, toujours validable humainement
Nostr = intention signee + journal souverain
PostgreSQL = etat metier operationnel
API admin = pilotage humain
IA = generation et adaptation controlees
Worker = orchestration publisher et taches asynchrones
Publishers = sorties externes controlees
```

---

## 2. Principes non negociables

- Nostr reste une racine souveraine des intentions editoriales et du journal de publication.
- PostgreSQL porte l etat metier operationnel.
- Aucun `nsec` ne doit etre stocke en clair.
- Les tokens OAuth doivent etre chiffres avant tout branchement reel durable.
- Pas de scraping de reseaux sociaux.
- Publication externe uniquement via API officielles.
- L IA propose, l humain valide, le publisher execute.
- Les contenus sensibles restent soumis a validation humaine.
- Les actions importantes doivent etre auditables.
- Un job deja publie ne doit jamais etre republie accidentellement.
- L archivage ne doit jamais supprimer l historique.
- `PUBLISHER_MODE=mock` reste le defaut sur tant que les publishers reels ne sont pas durcis.
- Telegram est hors scope comme canal de diffusion RelayPress et ne doit pas devenir une dependance technique prioritaire.
- BTC Breakdown sert de radar initial, pas de contenu a republier tel quel.

---

## 3. Etat courant du projet

| Element | Etat |
|---|---|
| Depot | `Copinmalin/relaypress` |
| Branche principale | `main` |
| Branche PR en cours | `pr-f-admin-create-jobs-from-signal` |
| Runtime | Node 24 |
| Monorepo | pnpm |
| API | Fastify |
| Base metier | PostgreSQL |
| Publisher actif par defaut | mock |
| Interface admin | jobs, publishers, sources recuperees, signaux editoriaux, preparation jobs depuis signal en PR F |
| Sources automatisees | ingestion minimale BTC Breakdown + admin `source_items` implementes |
| Signaux editoriaux | modele DB, qualification API et admin de tri implementes |
| Jobs depuis signaux | endpoint implemente, action admin en PR F |
| Generation IA | a implementer sous validation humaine |

---

## 4. Architecture logique synthetique cible

```text
Source editoriale recuperee ou brouillon manuel
-> SourceItem stocke si source recuperee
-> selection humaine dans l admin sources
-> EditorialSignal qualifie
-> tri humain du signal dans l admin
-> preparation explicite de publication_jobs par plateforme dans l admin
-> generation IA future ou edition humaine
-> validation humaine
-> worker
-> publisher mock ou reel
-> publication_job_runs
-> archivage non destructif
```

---

## 5. Statuts metier actifs

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

Les jobs crees depuis un signal `ready_for_campaign` sont crees uniquement en :

```text
pending_review
drafted
```

Cette action ne declenche aucune IA, aucun passage en `approved` et aucune publication.

---

## 6. Sources de verite specialisees

| Document | Role |
|---|---|
| `AGENTS.md` | regles de travail pour agents IA dans ce depot |
| `docs/08_SIGNAL_ENGINE.md` | cadrage du Signal Engine |
| `docs/09_PHASE_A_SOURCE_ITEMS.md` | modele `SourceItem`, statuts et garde-fous |
| `docs/10_PHASE_A2_BTCBREAKDOWN_INGESTION.md` | ingestion minimale BTC Breakdown |
| `docs/11_PHASE_A3_ADMIN_SOURCES.md` | admin des sources recuperees |
| `docs/12_PR_B_EDITORIAL_SIGNALS.md` | modele `EditorialSignal` |
| `docs/13_PR_C_SOURCE_SIGNAL_API.md` | API source selectionnee vers signal editorial |
| `docs/14_PR_D_ADMIN_EDITORIAL_SIGNALS.md` | admin des signaux editoriaux |
| `docs/15_PR_E_JOBS_FROM_SIGNAL.md` | creation explicite de jobs depuis signaux prets |
| `docs/16_PR_F_ADMIN_CREATE_JOBS_FROM_SIGNAL.md` | action admin pour preparer les jobs depuis un signal pret |
| `docs/03_SECURITY_MODEL.md` | securite, secrets, OAuth, logs, publication reelle |
| `docs/06_CI_NOTES.md` | CI, Node, pnpm, lockfile, Docker checks |

---

## 7. Phase actuelle et prochaines priorites

```text
PR F - Action admin pour preparer des jobs depuis un signal ready_for_campaign.
```

Backlog immediat :

```text
PR A1 - Schema SourceItem : implemente
PR A2 - Ingestion BTC Breakdown minimale : implemente
PR A3 - Admin sources recuperees : implemente
PR B - Signal editorial qualifie et rattachement source : implemente
PR C - API de qualification source selectionnee vers signal : implemente
PR D - Admin signaux editoriaux : implemente
PR E - Jobs depuis signal avec selection de plateformes : implemente
PR F - Action admin de preparation des jobs depuis signal : en cours
PR G - Generation IA controlee
PR H - Vue admin groupee par source / signal / campagne
PR I - Finaliser LinkedIn reel controle
```

---

## 8. Decisions structurantes recentes

| Date | Decision |
|---|---|
| 2026-05-25 | Trajectoire validee : BTC Breakdown -> selection humaine -> IA -> jobs par plateforme -> validation -> publication controlee. |
| 2026-06-05 | Signal Engine valide : BTC Breakdown comme radar initial, Telegram hors scope diffusion. |
| 2026-06-06 | Phase A1/A2/A3 implementees : `source_items`, ingestion BTC Breakdown et admin sources. |
| 2026-06-06 | PR B fusionnee : modele `editorial_signals`. |
| 2026-06-06 | PR C fusionnee : qualification humaine d une source `selected` en `EditorialSignal`. |
| 2026-06-07 | PR D fusionnee : admin des signaux editoriaux. |
| 2026-06-07 | PR E fusionnee : creation explicite de jobs depuis signal `ready_for_campaign`, avec selection humaine des plateformes. |
| 2026-06-07 | PR F lancee : action admin pour declencher cette preparation de jobs depuis `/admin/signals`. |

---

## 9. Risques actifs et points de vigilance

| Risque | Statut | Document de reference |
|---|---|---|
| Publication reelle accidentelle | controle par defaut mock | `docs/03_SECURITY_MODEL.md` |
| Generation IA publiee sans validation | interdit par doctrine | `docs/05_ROADMAP.md` |
| Signal transforme en publication automatique | hors scope PR B a PR F | `docs/12_PR_B_EDITORIAL_SIGNALS.md`, `docs/13_PR_C_SOURCE_SIGNAL_API.md`, `docs/14_PR_D_ADMIN_EDITORIAL_SIGNALS.md`, `docs/15_PR_E_JOBS_FROM_SIGNAL.md`, `docs/16_PR_F_ADMIN_CREATE_JOBS_FROM_SIGNAL.md` |
| Telegram transforme en dependance technique | hors scope initial | `docs/08_SIGNAL_ENGINE.md`, `docs/09_PHASE_A_SOURCE_ITEMS.md` |
| CI ou lockfile incoherent | a verifier a chaque PR | `docs/06_CI_NOTES.md` |

---

## 10. Prochaine action recommandee

```text
Ouvrir une Pull Request `pr-f-admin-create-jobs-from-signal` vers `main`, puis laisser tourner `RelayPress checks` avant merge.
```

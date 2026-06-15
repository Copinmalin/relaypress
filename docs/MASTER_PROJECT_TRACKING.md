# RelayPress - Master Project Tracking

Ce document est la source de verite operationnelle principale du projet RelayPress.

Derniere mise a jour : 2026-06-15

Etat global : MVP editorial souverain fonctionnel en staging. La trajectoire produit est recentree sur sources -> signaux editoriaux -> preparation explicite de jobs -> generation controlee -> validation -> publication multi-canal. La generation OpenAI controlee parse la sortie Responses API de maniere robuste, sans changer les garde-fous metier ni le mode mock par defaut. La generation evolue vers un profil B-Conseil source-grounded avec sortie JSON stricte, facts used, claims a verifier et format editorial reconnaissable. Les migrations DB sont serialisees par advisory lock PostgreSQL pour fiabiliser le demarrage concurrent API / worker.

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
| IA | OpenAI activable par environnement, fallback mock, sortie structuree en cours |
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
- Le profil par defaut vise B-Conseil by Copinmalin.
- La generation doit utiliser uniquement les sources fournies.
- Les chiffres non presents dans la source ne doivent pas etre inventes.
- Les extrapolations utiles doivent apparaitre dans `claims_requiring_human_review`, pas dans le texte comme faits etablis.
- La sortie OpenAI cible un JSON strict contenant notamment `final_text`, `facts_used`, `claims_requiring_human_review`, `source_url`, `format`, `tone` et `warnings`.

Formats editoriaux cibles :

| Plateforme | Format |
|---|---|
| LinkedIn | B-Conseil, 1300 a 2000 caracteres, structure accroche / ce qui se passe / pourquoi c est important / a surveiller / signature / source |
| X | 140 caracteres maximum imperatif |
| Facebook | 900 a 1500 caracteres |
| Blog Nostr | plan detaille et plus de 1500 caracteres |
| Instagram | hors scope court terme, futur couple image + texte Meta Business |

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

```text
PR A1 - Schema SourceItem : implemente
PR A2 - Ingestion BTC Breakdown minimale : implemente
PR A3 - Admin sources recuperees : implemente
PR B - Signal editorial qualifie et rattachement source : implemente
PR C - API de qualification source selectionnee vers signal : implemente
PR D - Admin signaux editoriaux : implemente
PR E - Jobs depuis signal avec selection de plateformes : implemente
PR F - Action admin de preparation de jobs depuis signal : implemente
PR G - Vue admin groupee source / signal / jobs : implemente
PR H - Generation IA controlee : implemente
PR I - Action admin pour declencher la generation controlee : implemente
PR J - Finaliser LinkedIn reel controle : en cours
PR U - Amelioration prompts generation B-Conseil source-grounded : en cours
```

---

## 9. Risques actifs

| Risque | Controle |
|---|---|
| Publication reelle accidentelle | `PUBLISHER_MODE=mock` par defaut, LinkedIn reel sous double opt-in runtime et runbook de rollback. |
| Generation IA publiee sans validation | `/publication-jobs/:id/generate` limite aux jobs non publies `pending_review` ou `drafted`, sans passage automatique en `approved`. |
| Republication accidentelle d un job | Le worker ne traite que les jobs `approved` sans `external_post_id` ni `published_at`, puis ecrit un run d audit. |
| Invention ou extrapolation IA | Prompt source-grounded, JSON strict, `facts_used`, `claims_requiring_human_review`, relecture humaine obligatoire. |
| Secrets dans le depot ou les logs | `.env` reel exclu, secrets documentes comme variables hors depot, aucun token OAuth ou `nsec` versionne. |
| Etat DB incoherent au demarrage | Migrations serialisees par advisory lock PostgreSQL entre API et worker. |
| Confusion entre warning metier et mode IA | Les warnings metier restent dans `error_message`; le mode et le modele de generation sont exposes separement. |

---

## 10. Smoke test staging valide

Le 2026-06-14, le parcours staging suivant a ete valide en mode controle :

```text
source -> signal -> jobs -> generation OpenAI -> validation humaine LinkedIn -> publication mock -> audit run
```

Resultats a conserver comme reference :

- generation OpenAI declenchee explicitement depuis l admin ;
- aucune approbation automatique apres generation ;
- validation humaine requise avant publication ;
- publication executee en mock ;
- run d audit cree ;
- anti-republication confirme par un second tick worker.

---

## 11. Regle documentaire

A compter de cette consolidation :

- Ne pas creer un fichier `docs/XX_PR_...` pour chaque PR.
- Mettre a jour ce Master si une PR change la doctrine, l architecture, les statuts, la securite, le publisher, la generation IA ou le deploiement.
- Creer un document separe uniquement pour un runbook critique ou une reference stable.
- Supprimer ou archiver les notes de PR une fois leur contenu consolide.
- Ne jamais dupliquer une verite operationnelle dans plusieurs fichiers actifs.

---

## 12. Backlog court recommande

1. Tester et stabiliser la generation B-Conseil source-grounded sur LinkedIn, X, Facebook et blog Nostr.
2. Preparer un test LinkedIn reel limite a un seul job, uniquement avec le runbook et rollback prets.
3. Stabiliser la doctrine des campagnes editoriales avant d ajouter de nouveaux publishers reels.

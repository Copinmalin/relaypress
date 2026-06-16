# RelayPress - Master Project Tracking

Ce document est la source de verite operationnelle principale du projet RelayPress.

Derniere mise a jour : 2026-06-16

Etat global : MVP editorial souverain fonctionnel en staging. La trajectoire produit est recentree sur sources -> signaux editoriaux -> campagnes multi-formats -> generation controlee -> validation -> publication multi-canal. La generation OpenAI controlee parse la sortie Responses API de maniere robuste, sans changer les garde-fous metier ni le mode mock par defaut. Le profil B-Conseil source-grounded produit des sorties structurees et des textes adaptes a chaque canal. La PR V ajoute la generation d une campagne LinkedIn, X, Facebook et Nostr long-form depuis un meme signal, sans approbation, publication ni archivage automatiques. Les migrations DB sont serialisees par advisory lock PostgreSQL pour fiabiliser le demarrage concurrent API / worker.

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
- La generation IA ne doit jamais archiver automatiquement un job.
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
| Admin | sources, signaux, jobs, vue groupee, generation IA controlee et campagne multi-format |
| IA | OpenAI activable par environnement, fallback mock, sortie structuree |
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

Campagne multi-format
  cree et genere plusieurs PublicationJob depuis un meme signal
  conserve chaque variante en pending_review
  tolere les echecs partiels sans publier

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
- Elle ne doit pas archiver automatiquement le job genere.
- Apres generation, le job reste `pending_review` ou `drafted` jusqu a une decision humaine : modifier, approuver, rejeter ou archiver.
- La route de campagne multi-format cree les jobs en `pending_review` et les genere sequentiellement.
- Une erreur de generation sur un canal ne doit pas annuler les autres variantes.
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

Route campagne multi-format :

```text
POST /editorial-signals/:id/generate-campaign
```

Comportement :

- signal obligatoire en `ready_for_campaign` ;
- plateformes par defaut : `linkedin`, `x`, `facebook`, `nostr_longform` ;
- creation idempotente des jobs ;
- generation sequentielle ;
- tous les jobs restent en `pending_review` ;
- aucune publication ni archivage ;
- resultat detaille par plateforme ;
- succes partiel possible.

Formats editoriaux cibles :

| Plateforme | Format |
|---|---|
| LinkedIn | B-Conseil, 1300 a 2000 caracteres, publication directe, CTA contextualise et source explicite |
| X | 140 caracteres maximum imperatif, limite appliquee de maniere deterministe si necessaire |
| Facebook | 900 a 1500 caracteres, pedagogique et accessible grand public |
| Nostr long-form | article complet de plus de 1500 caracteres, plan visible, analyse, limites, sources et CTA |
| Instagram | hors scope court terme, futur couple image + texte Meta Business |

`nostr_longform` est un format de preparation et de revue. Aucun publisher Nostr n est branche dans cette PR. Le worker ne doit donc pas reclamer ce type de job tant qu un publisher dedie n existe pas.

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
- Le publisher mock ne supporte pas `nostr_longform` dans cette phase ; la generation et la revue restent toutefois possibles.

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
PR U - Amelioration prompts generation B-Conseil source-grounded : implemente
PR V - Generation campagne LinkedIn / X / Facebook / Nostr long-form : en cours
```

---

## 9. Risques actifs

| Risque | Controle |
|---|---|
| Publication reelle accidentelle | `PUBLISHER_MODE=mock` par defaut, LinkedIn reel sous double opt-in runtime et runbook de rollback. |
| Generation IA publiee sans validation | Generation limitee aux jobs non publies `pending_review` ou `drafted`, sans passage automatique en `approved`. |
| Archivage premature apres generation | Les routes de generation n archivent jamais. Les scripts de smoke laissent les jobs en revue. |
| Doublons de campagne | IDs deterministes `signal:<signalId>:<platform>` et `on conflict do nothing`. |
| Echec d une plateforme | Resultat detaille par canal et traitement sequentiel ; les autres variantes sont conservees. |
| Depassement X | Adaptateur borne le contenu a 140 caracteres et expose un warning de troncature. |
| Nostr long-form approuve sans publisher | Le worker ne reclame que les plateformes supportees par le publisher selectionne. |
| Republication accidentelle d un job | Le worker ne traite que les jobs `approved` sans `external_post_id` ni `published_at`, puis ecrit un run d audit. |
| Invention ou extrapolation IA | Prompt source-grounded, JSON strict, `facts_used`, `claims_requiring_human_review`, relecture humaine obligatoire. |
| Secrets dans le depot ou les logs | `.env` reel exclu, secrets documentes comme variables hors depot, aucun token OAuth ou `nsec` versionne. |
| Etat DB incoherent au demarrage | Migrations serialisees par advisory lock PostgreSQL entre API et worker. |
| Confusion entre warning metier et mode IA | Les warnings metier restent dans `error_message`; le mode et le modele de generation sont exposes separement. |

---

## 10. Smoke tests staging

Parcours historique valide :

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

Le smoke test PR U laisse le job genere en `pending_review` pour permettre la revue humaine.

Le smoke test PR V doit verifier :

- quatre variantes depuis un meme signal ;
- LinkedIn, X, Facebook et Nostr long-form ;
- limite X de 140 caracteres ;
- article Nostr long-form de plus de 1500 caracteres avec plan visible ;
- tous les jobs en `pending_review` ;
- aucun `external_post_id` ;
- aucun `published_at` ;
- aucun archivage automatique.

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

1. Valider PR V en staging avec quatre variantes et revue humaine.
2. Preparer un test LinkedIn reel limite a un seul job, uniquement avec le runbook et rollback prets.
3. Concevoir le publisher Nostr long-form dans une PR distincte, apres validation du format editorial.
4. Ajouter Instagram et generation d image apres stabilisation LinkedIn, X et Meta.

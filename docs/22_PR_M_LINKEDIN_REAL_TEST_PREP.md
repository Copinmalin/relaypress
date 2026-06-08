# PR M - Preparation du test LinkedIn reel controle

## Objectif

PR M prepare le protocole d execution d un test LinkedIn reel controle.

Cette PR ne lance pas le test. Elle ne modifie aucun code et n ajoute aucun secret.

## Hors perimetre

- Aucun code.
- Aucune migration.
- Aucun endpoint.
- Aucun worker modifie.
- Aucun publisher modifie.
- Aucun secret dans le depot.
- Aucune publication reelle executee par cette PR.

## Principe de securite

Le mode permanent attendu reste :

```text
PUBLISHER_MODE=mock
```

Le mode LinkedIn reel ne doit etre active que pendant une fenetre courte, explicite, surveillee et reversible.

## Variables necessaires

### Admin et securite applicative

```text
ADMIN_API_TOKEN=<secret long et aleatoire>
TOKEN_ENCRYPTION_KEY=<secret long, hors depot>
SESSION_SECRET=<secret long, hors depot>
```

### OpenAI pour generation controlee

OpenAI n est pas obligatoire pour publier sur LinkedIn, mais il est necessaire si le test inclut une generation IA reelle avant validation humaine.

```text
OPENAI_API_KEY=<cle OpenAI hors depot>
OPENAI_MODEL=<modele OpenAI souhaite, optionnel>
```

Regles :

- ne jamais commiter `OPENAI_API_KEY` ;
- fournir la cle uniquement via l environnement de deploiement ;
- utiliser le mode mock si aucune cle n est disponible ;
- ne jamais considerer une generation IA comme une validation editoriale.

### Publisher LinkedIn reel

```text
PUBLISHER_MODE=linkedin_real
PUBLISHER_REAL_SAFETY_ACK=I_UNDERSTAND_LINKEDIN_REAL_PUBLISHING
LINKEDIN_ACCESS_TOKEN=<token LinkedIn hors depot>
LINKEDIN_AUTHOR_URN=<urn LinkedIn auteur ou organisation>
LINKEDIN_API_BASE_URL=https://api.linkedin.com/v2
```

Selon le flux OAuth utilise, verifier aussi :

```text
LINKEDIN_CLIENT_ID=<hors depot>
LINKEDIN_CLIENT_SECRET=<hors depot>
LINKEDIN_OAUTH_REDIRECT_URI=<url callback staging>
LINKEDIN_OAUTH_SCOPES=openid profile email w_member_social
```

## Preconditions avant test

- `RelayPress checks` verts sur `main`.
- Staging deploye depuis `main`.
- `docs/21_PR_L_STAGING_SMOKE_READINESS.md` execute et valide.
- Un seul job de test identifie.
- Le job de test est relu humainement.
- Le job de test est explicitement `approved` seulement au moment du test.
- Les logs applicatifs sont surveilles.
- Une personne est prete a remettre `PUBLISHER_MODE=mock` immediatement.

## Procedure de test controle

### 1. Avant activation reelle

Verifier que le mode courant est :

```text
PUBLISHER_MODE=mock
```

Verifier dans l admin :

```text
/admin
/admin/source-groups
```

Identifier le job cible et confirmer :

- plateforme `linkedin` ;
- contenu relu ;
- source conservee ;
- pas de donnees sensibles ;
- statut pas encore publie ;
- pas de `external_post_id`.

### 2. Generation IA si necessaire

Si une generation OpenAI est testee :

- verifier que `OPENAI_API_KEY` existe dans l environnement ;
- verifier le modele via `OPENAI_MODEL` si defini ;
- generer via l action admin ;
- relire et corriger humainement ;
- verifier que le job ne passe pas automatiquement en `approved`.

### 3. Armement LinkedIn reel

Pendant la fenetre de test uniquement :

```text
PUBLISHER_MODE=linkedin_real
PUBLISHER_REAL_SAFETY_ACK=I_UNDERSTAND_LINKEDIN_REAL_PUBLISHING
```

Redemarrer le worker concerne.

Verifier dans les logs que le publisher reel est explicitement arme.

### 4. Publication du job test

- approuver uniquement le job cible ;
- laisser le worker traiter le job ;
- verifier la creation d un `publication_job_run` ;
- verifier la presence d un `external_post_id` si LinkedIn accepte la publication ;
- verifier que les autres jobs ne sont pas publies.

## Criteres d arret immediat

Arreter le test et revenir au mock si :

- un job non cible passe en `publishing` ;
- un job non cible est publie ;
- LinkedIn retourne une erreur d authentification ou d autorisation ;
- OpenAI retourne une erreur inattendue persistante ;
- un secret apparait dans les logs ;
- `external_post_id` est absent apres une reponse supposee reussie ;
- le worker boucle ou relance plusieurs publications ;
- le contenu publie ne correspond pas au contenu valide.

## Rollback immediat vers mock

A la fin du test ou au premier critere d arret :

```text
PUBLISHER_MODE=mock
PUBLISHER_REAL_SAFETY_ACK=
```

Puis :

- redemarrer le worker ;
- verifier dans les logs que le publisher mock est actif ;
- verifier qu aucun nouveau post LinkedIn reel n est emis ;
- archiver ou marquer le job test selon l etat obtenu ;
- documenter le resultat dans une note de cloture.

## Donnees a collecter apres test

- identifiant du job ;
- statut final du job ;
- `external_post_id` si disponible ;
- horodatage de publication ;
- resultat LinkedIn ;
- erreurs eventuelles ;
- confirmation du retour en mock ;
- absence de secret dans les logs.

## Definition of Done

- Cette checklist existe.
- Les variables OpenAI et LinkedIn necessaires sont documentees sans valeur reelle.
- Le rollback mock est documente.
- Les criteres d arret sont documentes.
- La PR reste strictement documentaire.
- RelayPress checks passent.

# RelayPress - Runbook de test LinkedIn reel controle

Date : 2026-06-17

Le staging reste en mode mock par defaut.

## Objectif

Tester une publication LinkedIn reelle uniquement dans une fenetre courte, avec un seul job explicitement autorise.

Le test conserve :

```txt
validation humaine obligatoire
un seul job LinkedIn approuve
compte OAuth chiffre explicitement selectionne
double opt-in runtime LinkedIn
allowlist exacte du job
Posts API versionnee
observation des logs et du run
rollback immediat vers mock
```

## API utilisee

RelayPress utilise l API officielle LinkedIn Posts :

```txt
POST https://api.linkedin.com/rest/posts
Linkedin-Version: 202606
X-Restli-Protocol-Version: 2.0.0
```

La permission minimale de publication membre est :

```txt
w_member_social
```

PR X1 publie uniquement un post texte au nom d un membre :

```txt
urn:li:person:<subject OAuth>
```

Les Pages / organisations et les medias sont hors scope de ce runbook.

## Conditions prealables

1. La PR X1 est fusionnee et deployee.
2. Les checks et le smoke simule sont verts.
3. L application LinkedIn est configuree dans le Developer Portal.
4. Le produit donnant acces a `w_member_social` est actif.
5. La Redirect URL HTTPS correspond exactement a `LINKEDIN_OAUTH_REDIRECT_URI`.
6. `TOKEN_ENCRYPTION_KEY` et `SESSION_SECRET` sont definis hors depot.
7. Le compte LinkedIn est connecte depuis `/admin/publishers`.
8. Le test de connexion du compte retourne `connected`.
9. Les scopes affiches contiennent `w_member_social`.
10. L ID interne du compte est copie depuis `/admin/publishers`.
11. Aucun autre job n est en statut `approved`.

## Etat sur par defaut

```env
LINKEDIN_PUBLISHER_MODE=mock
LINKEDIN_REAL_SAFETY_ACK=
LINKEDIN_PUBLISHER_ACCOUNT_ID=
LINKEDIN_REAL_ALLOWED_JOB_ID=
LINKEDIN_API_BASE_URL=https://api.linkedin.com/rest
LINKEDIN_API_VERSION=202606
```

L ancien `PUBLISHER_MODE` ne peut pas activer LinkedIn reel.

Les anciens credentials :

```env
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_AUTHOR_URN=
```

ne sont pas utilises par le publisher reel PR X1.

## Preparation du job

1. Creer ou generer un job LinkedIn uniquement.
2. Relire tout le texte.
3. Verifier la source, les chiffres, le CTA et les mentions.
4. Conserver le job en `pending_review` tant que la relecture n est pas terminee.
5. Noter son ID exact.
6. Approuver uniquement ce job.
7. Verifier une nouvelle fois qu aucun autre job n est `approved`.

## Armement temporaire

Modifier temporairement l environnement serveur :

```env
LINKEDIN_PUBLISHER_MODE=real
LINKEDIN_REAL_SAFETY_ACK=I_UNDERSTAND_LINKEDIN_REAL_PUBLICATION
LINKEDIN_PUBLISHER_ACCOUNT_ID=<id interne publisher_accounts>
LINKEDIN_REAL_ALLOWED_JOB_ID=<id exact du job LinkedIn approuve>

X_PUBLISHER_MODE=disabled
FACEBOOK_PUBLISHER_MODE=disabled
INSTAGRAM_PUBLISHER_MODE=disabled
NOSTR_PUBLISHER_MODE=disabled
```

Les quatre conditions suivantes doivent etre vraies simultanement :

```txt
mode LinkedIn = real
safety ack exact
account ID exact
allowed job ID exact
```

Sans l une d elles, le routeur transforme LinkedIn en `disabled` et ne reclame aucun job.

## Execution

Redemarrer uniquement le worker :

```bash
docker compose up -d --force-recreate worker
docker compose logs -f --tail=100 worker
```

Observer au maximum un tick de publication.

Le plan de routage attendu contient :

```json
{
  "platform": "linkedin",
  "requestedMode": "real",
  "effectiveMode": "real",
  "safetyAckValid": true,
  "accountConfigured": true,
  "allowedJobIdConfigured": true
}
```

Le worker doit :

```txt
valider le compte avec userinfo
reclamer uniquement LINKEDIN_REAL_ALLOWED_JOB_ID
publier via /rest/posts
creer un run mode=real
enregistrer x-restli-id dans external_post_id
```

## Rollback immediat

Des que le tick est termine, succes ou echec, restaurer :

```env
LINKEDIN_PUBLISHER_MODE=mock
LINKEDIN_REAL_SAFETY_ACK=
LINKEDIN_PUBLISHER_ACCOUNT_ID=
LINKEDIN_REAL_ALLOWED_JOB_ID=
```

Puis :

```bash
docker compose up -d --force-recreate worker
docker compose logs --tail=100 worker
```

Verifier que le plan de routage LinkedIn est revenu en `mock`.

## Verification apres publication

Dans RelayPress :

```txt
job.status = published
job.external_post_id = urn:li:share:... ou urn:li:ugcPost:...
job.published_at non null
run.status = published
run.mode = real
```

Sur LinkedIn :

- verifier que le post existe ;
- verifier le texte complet ;
- verifier le profil auteur ;
- verifier qu aucun doublon n existe.

## Gestion des erreurs

### Token ou compte non valide

Le publisher reste non ready et ne reclame pas le job.

Actions :

```txt
tester la connexion depuis /admin/publishers
relancer OAuth si necessaire
verifier w_member_social
verifier LINKEDIN_PUBLISHER_ACCOUNT_ID
```

### Erreur API avant creation

Le job passe en `failed` avec une erreur nettoyee et un run auditable.

Ne pas relancer sans comprendre la reponse LinkedIn.

### Reponse 201 sans x-restli-id

Le run contient :

```txt
postMayHaveBeenCreated = true
```

Dans ce cas :

1. ne pas utiliser Retry ;
2. verifier manuellement le profil LinkedIn ;
3. rechercher le post cree ;
4. reconciler l external ID avant toute nouvelle tentative.

Cette regle evite une duplication apres une creation reussie dont l identifiant n aurait pas ete capture.

## Cloture du test

Documenter sans secret :

```txt
date et heure
job id
publisher account id
run id
statut final
external_post_id si succes
erreur nettoyee si echec
confirmation du rollback mock
decision : continuer / corriger / durcir
```

Ne jamais documenter :

```txt
access token
refresh token
client secret
contenu du safety ack reel si un autre mecanisme le remplace
TOKEN_ENCRYPTION_KEY
ADMIN_API_TOKEN
```

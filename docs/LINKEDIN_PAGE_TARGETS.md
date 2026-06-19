# RelayPress - LinkedIn Page targets

Date : 2026-06-19

## Objectif

Publier sur une Page LinkedIn au lieu du profil membre OAuth, tout en conservant les garde-fous PR X1.

Page B-Conseil :

```text
urn:li:organization:107402555
```

## Principe

RelayPress separe deux notions :

```text
compte OAuth humain
cible de publication
```

Le compte OAuth reste le membre connecte dans `/admin/publishers`. La cible est l auteur envoye a LinkedIn dans `POST /rest/posts`.

## Configuration

```env
LINKEDIN_PUBLISHER_TARGET_URN=urn:li:organization:107402555
```

Si cette variable est vide, RelayPress conserve le comportement PR X1 : publication sur le profil OAuth.

## Scopes

Profil membre :

```text
w_member_social
```

Page LinkedIn :

```text
w_organization_social
```

Lecture des Pages administrables :

```text
r_organization_admin
```

Configuration OAuth recommandee pour publier sur profil ou Page :

```env
LINKEDIN_OAUTH_SCOPES="openid profile email w_member_social w_organization_social r_organization_admin"
```

Il faut reconnecter le compte OAuth apres ajout de scopes.

## Readiness Page

Avant de reclamer un job reel avec une cible organisation, le worker doit :

```text
1. valider le compte OAuth membre avec userinfo ;
2. verifier le scope w_organization_social ;
3. interroger organizationAcls ;
4. confirmer que la Page cible est approuvee pour le membre ;
5. refuser tout claim si la Page n est pas autorisee.
```

## Armement reel

Les verrous PR X1 restent obligatoires :

```env
LINKEDIN_PUBLISHER_MODE=real
LINKEDIN_REAL_SAFETY_ACK=I_UNDERSTAND_LINKEDIN_REAL_PUBLICATION
LINKEDIN_PUBLISHER_ACCOUNT_ID=<id interne publisher_accounts>
LINKEDIN_REAL_ALLOWED_JOB_ID=<id exact du job approuve>
LINKEDIN_PUBLISHER_TARGET_URN=urn:li:organization:107402555
```

Comme pour PR X1, utiliser une execution one-shot puis revenir immediatement a :

```env
LINKEDIN_PUBLISHER_MODE=mock
LINKEDIN_REAL_SAFETY_ACK=
LINKEDIN_PUBLISHER_ACCOUNT_ID=
LINKEDIN_REAL_ALLOWED_JOB_ID=
LINKEDIN_PUBLISHER_TARGET_URN=
```

## Smoke

Le smoke dedie ne contacte pas LinkedIn :

```bash
bash scripts/smoke-pr-x1-1-linkedin-page-target.sh
```

Il verifie :

```text
route LinkedIn real armee
cible urn:li:organization:107402555
test userinfo
verification organizationAcls
POST /posts avec author = Page
un seul job publie
run mode=real avec targetUrn auditee
```

## Hors scope

```text
publication reelle pendant la PR
medias
carrousels
publication multi-pages
selection UI avancee
```

# Modèle de sécurité

RelayPress manipule des éléments sensibles : identité Nostr, tokens OAuth, calendrier éditorial, contenus avant publication, validations humaines et droits de publication externe.

## Principes non négociables

- Ne jamais stocker de clé privée Nostr principale en clair.
- Ne jamais documenter de secrets réels dans le dépôt.
- Chiffrer les tokens OAuth au repos avant tout branchement réel.
- Utiliser uniquement les API officielles des plateformes.
- Refuser le scraping et les automatisations de navigateur fragiles.
- Séparer l’intention, la validation et l’exécution.
- Journaliser les actions sans exposer les secrets.
- Empêcher toute republication accidentelle d’un job déjà publié.
- Configurer chaque publisher séparément.
- Garder chaque plateforme en `mock` ou `disabled` tant que son publisher réel n’est pas durci.
- Toute publication réelle exige une validation humaine explicite.

## Nostr

Nostr porte l’intention signée et le journal souverain.

RelayPress ne doit pas devenir un coffre à `nsec`.

Pour les signatures Nostr, la cible à terme reste :

- NIP-46 ;
- signer externe ;
- ou autre mécanisme évitant le stockage de clé privée principale en clair.

En staging, l’indexation est limitée par :

```txt
NOSTR_INDEX_ALL=false
NOSTR_ALLOWED_PUBKEYS=<pubkey autorisée>
```

## API admin

Les endpoints éditoriaux sont protégés par `ADMIN_API_TOKEN`.

Le token dans `localStorage` est acceptable pour un staging technique mono-utilisateur. Ce n’est pas acceptable comme modèle durable pour une production multi-utilisateur.

À renforcer avant production :

- authentification web propre ;
- sessions sécurisées ;
- protection CSRF si cookies de session ;
- rate limiting ;
- rotation de secrets ;
- journalisation d’accès ;
- séparation des rôles si multi-utilisateur.

## OAuth publishers

Les connexions aux plateformes externes doivent prévoir :

- stockage chiffré ;
- refresh token quand disponible ;
- révocation ;
- expiration ;
- limitation de périmètre ;
- scopes documentés ;
- journalisation des erreurs API ;
- absence de token dans les logs ;
- absence de token dans `raw_response`.

La table `publisher_accounts` contient notamment :

```txt
provider
account_urn
display_name
status
encrypted_access_token
encrypted_refresh_token
token_expires_at
refresh_token_expires_at
scopes
last_validated_at
created_at
updated_at
```

Le chiffrement utilise `TOKEN_ENCRYPTION_KEY`.

## Routage multi-publishers

Chaque plateforme possède son propre mode :

```txt
LINKEDIN_PUBLISHER_MODE
X_PUBLISHER_MODE
FACEBOOK_PUBLISHER_MODE
INSTAGRAM_PUBLISHER_MODE
NOSTR_PUBLISHER_MODE
```

Le paramètre historique :

```txt
PUBLISHER_MODE
```

est seulement conservé pour visibilité de migration. Il ne peut pas armer de publication réelle.

## LinkedIn réel contrôlé

PR X1 autorise `real` uniquement pour LinkedIn.

Les quatre verrous suivants sont simultanément obligatoires :

```txt
LINKEDIN_PUBLISHER_MODE=real
LINKEDIN_REAL_SAFETY_ACK=I_UNDERSTAND_LINKEDIN_REAL_PUBLICATION
LINKEDIN_PUBLISHER_ACCOUNT_ID=<id interne exact>
LINKEDIN_REAL_ALLOWED_JOB_ID=<id exact du job approuvé>
```

Sans l’un de ces éléments, le routeur produit :

```txt
effectiveMode=disabled
```

avec une raison explicite, sans réclamer de job.

### Allowlist du job

Le publisher LinkedIn réel :

- réclame uniquement `LINKEDIN_REAL_ALLOWED_JOB_ID` ;
- publie au maximum un job par tick ;
- refuse aussi le job dans `publish()` si son ID ne correspond pas ;
- laisse tous les autres jobs LinkedIn en `approved`.

Cette double vérification protège contre une erreur de requête ou de routage.

### Sélection du compte

Le compte est sélectionné uniquement par :

```txt
LINKEDIN_PUBLISHER_ACCOUNT_ID
```

Aucune sélection implicite du dernier compte n’est autorisée.

Le publisher exige :

- `provider = linkedin` ;
- `status = connected` ;
- une URN membre `urn:li:person:...` ;
- le scope `w_member_social` ;
- un access token chiffré non expiré ;
- un `userinfo.sub` correspondant à l’URN du compte.

Les variables historiques :

```txt
LINKEDIN_ACCESS_TOKEN
LINKEDIN_AUTHOR_URN
```

ne sont pas utilisées pour armer le publisher réel PR X1.

### API LinkedIn

PR X1 utilise :

```txt
POST https://api.linkedin.com/rest/posts
Linkedin-Version: 202606
X-Restli-Protocol-Version: 2.0.0
```

Le payload texte contient uniquement :

```txt
author
commentary
visibility
distribution
lifecycleState
isReshareDisabledByAuthor
```

Le publisher récupère `x-restli-id` comme `external_post_id`.

Si LinkedIn répond 201 sans identifiant, le run indique :

```txt
postMayHaveBeenCreated=true
```

Le job ne doit pas être relancé automatiquement. Une vérification humaine est obligatoire pour éviter un doublon.

### Heartbeat et expiration

Avant claim, `isReady()` :

1. charge le compte chiffré exact ;
2. rafraîchit l’access token si un refresh token valide est disponible et nécessaire ;
3. appelle `userinfo` ;
4. vérifie la concordance du sujet ;
5. marque le compte `invalid` sur 401/403 ou mismatch ;
6. refuse le claim si le compte n’est pas prêt.

Les refresh tokens programmatiques ne sont pas supposés disponibles pour toutes les applications. En leur absence, une nouvelle OAuth est nécessaire avant expiration de l’access token.

## Safety acknowledgements par plateforme

Les verrous séparés sont :

```txt
LINKEDIN_REAL_SAFETY_ACK
X_REAL_SAFETY_ACK
META_REAL_SAFETY_ACK
NOSTR_REAL_SAFETY_ACK
```

Seul le verrou LinkedIn est actif dans PR X1. X, Meta, Instagram et Nostr restent bloqués en mode `real`.

Les logs n’affichent jamais le contenu d’un safety ack. Ils exposent seulement :

```txt
safetyAckConfigured
safetyAckValid
accountConfigured
allowedJobIdConfigured
```

## IA

L’IA doit rester encadrée par une logique de contraintes éditoriales.

Les contenus suivants exigent une validation humaine :

- contenu politique ;
- affirmation chiffrée ou statistique ;
- sponsor ou partenariat ;
- conseil financier ;
- contenu polémique ;
- image générée destinée à publication publique ;
- publication réelle vers une plateforme externe.

## Publication

Chaque publication externe doit être idempotente et traçable.

RelayPress doit éviter :

- les doublons ;
- les retries infinis ;
- la publication d’un ancien job devenu obsolète ;
- la publication si OAuth est expiré ;
- la publication si le contenu dépasse les contraintes de plateforme ;
- la publication réelle sans validation explicite ;
- le claim d’un job appartenant à une plateforme `disabled` ;
- le claim d’un job LinkedIn réel qui n’est pas explicitement allowlisté.

Le worker publie uniquement les jobs :

```txt
status = approved
external_post_id is null
published_at is null
platform présente dans le registry
publisher de la plateforme ready
contraintes du publisher satisfaites
```

## Archivage

L’archivage est non destructif.

Un job archivé reste conservé avec ses runs pour audit. Il est seulement masqué des vues actives.

## Secrets et logs

Les logs peuvent contenir :

- composant ;
- statut ;
- job ID ;
- plateforme ;
- mode demandé ;
- mode effectif ;
- booléens des garde-fous ;
- account ID interne ;
- longueur de contenu ;
- version API ;
- erreur métier ou API nettoyée.

Les logs ne doivent pas contenir :

- access token ;
- refresh token ;
- client secret ;
- contenu du safety ack ;
- `nsec` ;
- secret de session ;
- token admin ;
- payload API contenant des secrets.

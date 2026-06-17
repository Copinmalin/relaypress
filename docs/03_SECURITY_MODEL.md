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

Le modèle cible est une table `publisher_accounts` contenant au minimum :

```txt
provider
account_urn
display_name
encrypted_access_token
encrypted_refresh_token
token_expires_at
scopes
created_at
updated_at
```

Le chiffrement doit utiliser `TOKEN_ENCRYPTION_KEY` ou un mécanisme équivalent suffisamment durci.

## Routage multi-publishers

PR X0 remplace le sélecteur global par un mode propre à chaque plateforme :

```txt
LINKEDIN_PUBLISHER_MODE
X_PUBLISHER_MODE
FACEBOOK_PUBLISHER_MODE
INSTAGRAM_PUBLISHER_MODE
NOSTR_PUBLISHER_MODE
```

Modes autorisés dans PR X0 :

```txt
mock
disabled
```

Toute valeur `real` ou inconnue est convertie en `disabled` avec une raison explicite dans les logs.

Le paramètre historique :

```txt
PUBLISHER_MODE
```

est seulement conservé pour visibilité de migration. Il ne peut plus armer de publication réelle.

## Safety acknowledgements par plateforme

Les futures activations réelles utiliseront des verrous séparés :

```txt
LINKEDIN_REAL_SAFETY_ACK
X_REAL_SAFETY_ACK
META_REAL_SAFETY_ACK
NOSTR_REAL_SAFETY_ACK
```

PR X0 ne consomme pas ces valeurs pour publier. Le worker journalise seulement un booléen `safetyAckConfigured`, jamais leur contenu.

Une activation réelle devra exiger simultanément :

1. mode réel de la plateforme ;
2. safety ack exact de la plateforme ;
3. credentials valides ;
4. readiness check positif ;
5. job explicitement `approved` ;
6. runbook de test et rollback.

## LinkedIn réel

Le code du publisher LinkedIn réel reste présent mais n’est pas sélectionnable par le routeur PR X0.

La future PR LinkedIn devra utiliser :

```txt
LINKEDIN_PUBLISHER_MODE=real
LINKEDIN_REAL_SAFETY_ACK=<valeur attendue>
```

et ne devra réclamer aucun job si les credentials, scopes ou contrôles de sécurité ne sont pas valides.

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
- le claim d’un job appartenant à une plateforme `disabled`.

Le worker doit publier uniquement les jobs :

```txt
status = approved
external_post_id is null
published_at is null
platform présente dans le registry
publisher de la plateforme ready
```

## Archivage

L’archivage est non destructif.

Un job archivé doit rester conservé avec ses runs pour audit. Il est seulement masqué des vues actives.

## Secrets et logs

Les logs peuvent contenir :

- composant ;
- statut ;
- job ID ;
- plateforme ;
- mode demandé ;
- mode effectif ;
- booléen de présence du safety ack ;
- longueur de contenu ;
- erreur métier ou API nettoyée.

Les logs ne doivent pas contenir :

- access token ;
- refresh token ;
- contenu du safety ack ;
- `nsec` ;
- secret de session ;
- token admin ;
- payload API contenant des secrets.

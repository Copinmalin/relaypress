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
- Garder `PUBLISHER_MODE=mock` par défaut tant que les publishers réels ne sont pas durcis.

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

## LinkedIn réel

Le publisher LinkedIn réel est préparé mais non actif.

Le mode :

```txt
PUBLISHER_MODE=linkedin_real
```

ne doit être activé qu’après :

1. validation du mode d’auth LinkedIn ;
2. définition exacte de `LINKEDIN_AUTHOR_URN` ;
3. token contrôlé ;
4. gestion des erreurs API ;
5. audit dans `publication_job_runs` ;
6. vérification que le worker ne claim pas de jobs si le publisher n’est pas prêt.

Si `LINKEDIN_ACCESS_TOKEN` ou `LINKEDIN_AUTHOR_URN` manque, le worker doit skip sans claim.

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
- la publication réelle sans validation explicite.

Le worker doit publier uniquement les jobs :

```txt
status = approved
external_post_id is null
published_at is null
platform compatible avec le publisher actif
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
- longueur de contenu ;
- erreur métier ou API nettoyée.

Les logs ne doivent pas contenir :

- access token ;
- refresh token ;
- `nsec` ;
- secret de session ;
- token admin ;
- payload API contenant des secrets.

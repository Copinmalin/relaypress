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
- Garder chaque publisher en `mock` ou `disabled` par défaut tant que son mode réel n’est pas durci.
- Ne jamais utiliser un interrupteur générique pour armer plusieurs plateformes réelles.

## Routage multi-publishers

Le worker route les jobs approuvés selon leur plateforme :

```txt
linkedin
x
facebook
instagram
nostr_longform
```

Chaque plateforme possède un mode indépendant :

```txt
disabled
mock
real
```

Variables de configuration :

```txt
LINKEDIN_PUBLISHER_MODE
X_PUBLISHER_MODE
FACEBOOK_PUBLISHER_MODE
INSTAGRAM_PUBLISHER_MODE
NOSTR_PUBLISHER_MODE
```

Règles :

- `disabled` : aucun publisher, aucun claim ;
- `mock` : publication simulée et auditée ;
- `real` : nécessite un publisher dédié, une readiness valide et son safety ack propre ;
- un publisher non prêt ne doit jamais réclamer de job ;
- un job approuvé sur une plateforme désactivée reste approuvé ;
- `PUBLISHER_MODE` est conservé uniquement comme compatibilité transitoire et doit être retiré après migration.

Dans PR X0, tous les modes réels sont volontairement bloqués. Même avec un safety ack correct, aucun appel réseau réel n’est effectué.

## Safety acknowledgements

Chaque famille de publisher réel possède son propre acknowledgement :

```txt
LINKEDIN_REAL_SAFETY_ACK
X_REAL_SAFETY_ACK
META_REAL_SAFETY_ACK
NOSTR_REAL_SAFETY_ACK
```

Un acknowledgement ne doit jamais armer une autre plateforme.

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

Le publisher LinkedIn réel existe dans le code historique mais ne doit pas être routé en PR X0.

La future activation devra utiliser :

```txt
LINKEDIN_PUBLISHER_MODE=real
LINKEDIN_REAL_SAFETY_ACK=<valeur documentée dans le runbook LinkedIn>
```

Elle ne devra être possible qu’après :

1. validation du mode d’auth LinkedIn ;
2. définition exacte du compte auteur ;
3. token contrôlé et chiffré ;
4. gestion des erreurs API ;
5. audit dans `publication_job_runs` ;
6. vérification que le worker ne claim pas de jobs si le publisher n’est pas prêt ;
7. test réel limité à un seul job ;
8. rollback immédiat vers `mock`.

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
platform compatible avec le publisher routé
publisher prêt avant claim
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
- mode publisher ;
- longueur de contenu ;
- erreur métier ou API nettoyée.

Les logs ne doivent pas contenir :

- access token ;
- refresh token ;
- `nsec` ;
- secret de session ;
- token admin ;
- safety ack ;
- payload API contenant des secrets.

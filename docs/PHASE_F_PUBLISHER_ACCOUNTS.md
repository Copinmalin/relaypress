# RelayPress — Phase F Publisher Accounts

Date : 2026-05-05

## Objectif

Sortir progressivement de la gestion manuelle des publishers via fichiers `.env` et poser une base propre pour gérer les comptes de publication.

## Incrément 1

Statut : en cours

Réalisé :

```txt
- table publisher_accounts
- schéma Drizzle associé
- migration SQL idempotente
- chiffrement applicatif AES-256-GCM
- route admin GET /publisher-accounts
- route admin GET /publisher-accounts/:id
- route admin POST /publisher-accounts
- réponses API sans exposition des secrets chiffrés
```

## Modèle publisher_accounts

```txt
id
provider
account_urn
display_name
status
scopes
encrypted_access_token
encrypted_refresh_token
token_expires_at
refresh_token_expires_at
last_validated_at
created_at
updated_at
```

## Décision

Le worker ne bascule pas encore automatiquement sur `publisher_accounts`.

La prochaine étape sera de faire lire le compte LinkedIn actif depuis la base, avec fallback contrôlé vers `.env` pendant la transition.

## Sécurité

```txt
- aucun secret ne doit être retourné par l’API
- les secrets sont chiffrés avant stockage
- TOKEN_ENCRYPTION_KEY est obligatoire pour créer un compte publisher
- les logs ne doivent pas contenir les valeurs sensibles
```

## Prochaine étape

```txt
1. Déployer l’API avec la migration.
2. Créer le compte LinkedIn dans publisher_accounts.
3. Vérifier que la réponse API ne renvoie que hasAccessToken / hasRefreshToken.
4. Ajouter la lecture du compte LinkedIn actif côté worker.
5. Supprimer progressivement la dépendance opérationnelle à .env.linkedin-real.
```

# RelayPress — Phase F Publisher Accounts

Date : 2026-05-05

## Objectif

Sortir progressivement de la gestion manuelle des publishers via fichiers `.env` et poser une base propre pour gérer les comptes de publication.

## Incrément 1 — Base publisher_accounts

Statut : ✅ réalisé

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

## Incrément 2 — Lecture worker depuis la base

Statut : ✅ réalisé côté code, à valider en staging

```txt
- readiness publisher asynchrone
- déchiffrement côté worker
- lecture du compte LinkedIn connecté depuis publisher_accounts
- exclusion des comptes expirés
- fallback temporaire vers .env si aucun compte actif n’est trouvé
- raw_response enrichie avec credentialSource et accountId sans secret
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

Le worker peut maintenant utiliser `publisher_accounts` pour LinkedIn, tout en gardant un fallback `.env` pendant la transition.

Le mode permanent staging reste `PUBLISHER_MODE=mock`. Les tests réels LinkedIn doivent rester des fenêtres explicitement ouvertes.

## Sécurité

```txt
- aucun secret ne doit être retourné par l’API
- les secrets sont chiffrés avant stockage
- TOKEN_ENCRYPTION_KEY est obligatoire pour créer ou lire un compte publisher
- les logs ne doivent pas contenir les valeurs sensibles
- refresh_token_expires_at reste null si aucun refresh token n’est stocké
```

## État staging observé

```txt
provider: linkedin
account_urn: urn:li:person:6O3dES5ro0
display_name: Cyrille Coppéré
status: connected
scopes: email, openid, profile, w_member_social
has_access_token: true
has_refresh_token: false
token_expires_at: 2026-07-04 21:50:33 UTC
```

## Prochaine étape

```txt
1. Redéployer api + worker.
2. Vérifier que la CI passe.
3. Lancer un test LinkedIn réel sans LINKEDIN_ACCESS_TOKEN dans l’override local.
4. Vérifier que publication_job_runs.raw_response indique credentialSource=publisher_accounts.
5. Si validé, supprimer progressivement la dépendance opérationnelle à .env.linkedin-real.
6. Ajouter un écran admin publisher accounts.
```

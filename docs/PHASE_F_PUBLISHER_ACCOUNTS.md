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

Statut : ✅ réalisé côté code, ✅ validé en staging

```txt
- readiness publisher asynchrone
- déchiffrement côté worker
- lecture du compte LinkedIn connecté depuis publisher_accounts
- exclusion des comptes expirés
- fallback temporaire vers .env si aucun compte actif n’est trouvé
- raw_response enrichie avec credentialSource et accountId sans secret
- publication LinkedIn réelle validée via publisher_accounts
```

## Incrément 3 — Admin publishers

Statut : ✅ réalisé côté code, ✅ validé côté API, à valider visuellement après dernier déploiement

```txt
- page /admin/publishers
- lien depuis /admin
- affichage provider, statut, URN, scopes, expiration et dernière validation
- affichage booléen hasAccessToken / hasRefreshToken sans secret
- action serveur check-connection
- bouton Tester la connexion dans /admin/publishers
```

## Incrément 4 — OAuth LinkedIn depuis admin

Statut : ✅ réalisé côté code, à valider en staging

```txt
- bouton Connecter / renouveler LinkedIn dans /admin/publishers
- route admin POST /publisher-accounts/linkedin/oauth/start
- callback GET /publisher-accounts/linkedin/oauth/callback
- state OAuth signé et expirant
- échange serveur-à-serveur du code OAuth
- lecture userinfo côté serveur
- upsert chiffré dans publisher_accounts
- retour vers /admin/publishers avec statut success/error
```

## Variables OAuth LinkedIn

```txt
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET
LINKEDIN_OAUTH_REDIRECT_URI=https://api.relaypress.copinmalin.top/publisher-accounts/linkedin/oauth/callback
LINKEDIN_OAUTH_SCOPES=openid profile email w_member_social
```

La même URL de callback doit être ajoutée dans LinkedIn Developer comme Authorized redirect URL.

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
- le test de connexion est exécuté côté serveur et ne renvoie qu’un diagnostic filtré
- le callback OAuth est public mais protégé par un state signé et expirant
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

## Contrôle CI

Les runs échoués du 2026-05-05 portaient sur des commits intermédiaires de la migration `isReady()` asynchrone. Le contrôle utile doit être effectué sur `main` après les commits worker `dda7a4e` et documentation `d70b57e`.

## Prochaine étape

```txt
1. Redéployer api.
2. Vérifier que la CI passe sur la tête actuelle de main.
3. Ajouter la callback OAuth RelayPress dans LinkedIn Developer.
4. Ouvrir /admin/publishers.
5. Cliquer Connecter / renouveler LinkedIn.
6. Vérifier retour success et compte LinkedIn mis à jour.
7. Vérifier Tester la connexion.
```

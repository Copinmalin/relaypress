# RelayPress — Succès Phase F LinkedIn via publisher_accounts — 2026-05-06

Date : 2026-05-06

## Contexte

Validation de l’incrément Phase F : le worker LinkedIn réel doit pouvoir publier sans recevoir directement `LINKEDIN_ACCESS_TOKEN` ni `LINKEDIN_AUTHOR_URN` via override local.

Le compte LinkedIn est stocké dans `publisher_accounts` avec accès chiffré.

## Résultat

```txt
Statut : succès
Publisher actif : linkedin-publisher
Mode de test : linkedin_real
Source credentials attendue : publisher_accounts
Retour final : publication LinkedIn réelle créée
```

## Validation technique

```txt
- CI verte avant test staging
- api + worker redéployés
- compte LinkedIn présent dans publisher_accounts
- access token chiffré en base
- aucun refresh token stocké pour l’instant
- override local sans LINKEDIN_ACCESS_TOKEN
- worker lancé en PUBLISHER_MODE=linkedin_real
- publication LinkedIn réelle confirmée
- retour attendu en PUBLISHER_MODE=mock après test
```

## Décision projet

La Phase F est validée pour un premier cas réel LinkedIn membre avec lecture des credentials depuis `publisher_accounts`.

Le fichier `.env.linkedin-real` et les overrides locaux restent des outils transitoires de test. Ils ne doivent pas devenir la méthode d’exploitation long terme.

## Points à traiter ensuite

```txt
1. Vérifier dans publication_job_runs.raw_response que credentialSource=publisher_accounts.
2. Conserver PUBLISHER_MODE=mock comme mode permanent staging.
3. Ajouter une interface admin pour visualiser les comptes publishers.
4. Ajouter une action de validation / test de connexion publisher.
5. Préparer la rotation / régénération des accès LinkedIn.
6. Préparer le cas LinkedIn organisation/page.
7. Supprimer progressivement les manipulations manuelles via override local.
```

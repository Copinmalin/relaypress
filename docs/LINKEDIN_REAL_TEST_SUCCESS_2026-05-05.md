# RelayPress — Succès test LinkedIn réel — 2026-05-05

Date : 2026-05-05

## Contexte

Test contrôlé du publisher LinkedIn réel en staging.

## Résultat

```txt
Statut : succès
Publisher actif : linkedin-publisher
Mode de test : linkedin_real
Retour final : publication LinkedIn réelle créée
Retour staging après test : mock
```

## Publication créée

```txt
https://www.linkedin.com/posts/cyrillecoppere_bitcoin-souverainetaeznumaezrique-relaypress-share-7457539014468726784-lr_7
```

## Validation technique

```txt
- le worker a été lancé en mode linkedin_real pendant la fenêtre de test
- le compte LinkedIn cible a été validé via l’endpoint userinfo
- le publisher LinkedIn réel a publié un contenu approuvé
- le lien public LinkedIn confirme la création du post
- le worker a ensuite été remis en mode mock
```

## Décision projet

La Phase E est validée pour un premier cas membre LinkedIn contrôlé.

Le mode réel ne doit pas rester actif en permanence sur staging. Le fonctionnement normal reste le mode mock, sauf fenêtre de test explicitement ouverte.

## Points à traiter avant production

```txt
1. Ne plus manipuler les accès LinkedIn à la main dans des fichiers locaux long terme.
2. Créer une table publisher_accounts.
3. Chiffrer les accès publishers au repos.
4. Prévoir la rotation et l’expiration.
5. Ajouter un écran admin de connexion / état publisher.
6. Ajouter une confirmation explicite avant publication réelle.
7. Documenter la procédure membre vs page organisation.
```

## État de clôture attendu

```txt
PUBLISHER_MODE=mock
```

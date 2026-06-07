# RelayPress - Runbook de test LinkedIn reel controle

Date : 2026-06-07

Le staging reste en mode mock par defaut.

## Objectif

Tester LinkedIn reel uniquement dans une fenetre courte et controlee.

Le test doit conserver :

```txt
- validation humaine obligatoire
- un seul job LinkedIn approuve
- observation des logs worker
- retour immediat au mode mock apres test
- double opt-in runtime pour le mode reel
```

## Garde-fou supplementaire

PR J ajoute une variable runtime obligatoire pour activer LinkedIn reel.

Sans cette confirmation explicite, `PUBLISHER_MODE=linkedin_real` retombe sur le publisher mock.

Variable attendue uniquement pendant la fenetre de test :

```txt
PUBLISHER_REAL_SAFETY_ACK=valeur_de_confirmation_documentee_dans_le_code
```

Ne jamais commiter de token LinkedIn, client secret, access token ou refresh token.

## Procedure courte

1. Verifier que la CI est verte.
2. Redeployer staging.
3. Verifier que le worker est en mode mock.
4. Creer un brouillon manuel LinkedIn uniquement.
5. Relire le contenu.
6. Approuver uniquement ce job.
7. Activer temporairement le mode reel et la confirmation runtime sur le serveur.
8. Redemarrer uniquement le worker.
9. Observer les logs.
10. Verifier le run et `external_post_id`.
11. Restaurer immediatement le mode mock.

## Verification avant test

```bash
grep '^PUBLISHER_MODE=' .env
grep '^PUBLISHER_REAL_SAFETY_ACK=' .env || true
```

Hors fenetre de test, le resultat attendu est :

```txt
PUBLISHER_MODE=mock
PUBLISHER_REAL_SAFETY_ACK absent ou vide
```

## Verification apres test

```bash
grep '^PUBLISHER_MODE=' .env
grep '^PUBLISHER_REAL_SAFETY_ACK=' .env || true
```

Le mode mock doit etre restaure immediatement.

## Cloture

Documenter sans secret :

```txt
- date du test
- job id
- run id
- statut final
- external_post_id si succes
- erreur nettoyee si echec
- decision : continuer / corriger / durcir avant nouveau test
```

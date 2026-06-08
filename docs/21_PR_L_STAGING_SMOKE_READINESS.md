# PR L - Staging smoke test & readiness checklist

## Objectif

PR L ajoute une checklist manuelle de verification staging apres deploiement.

Cette PR est strictement documentaire.

## Hors perimetre

- Aucun code.
- Aucune migration.
- Aucun endpoint.
- Aucun worker modifie.
- Aucun publisher modifie.
- Aucun secret.
- Aucune publication reelle.

## Preconditions staging

Avant de commencer :

```text
PUBLISHER_MODE=mock
```

Le mode mock est le mode permanent attendu en staging hors fenetre de test reel controle.

Verifier aussi que les secrets reels ne sont pas presents dans le depot et que les variables sensibles restent fournies uniquement par l environnement de deploiement.

## Smoke test admin

### 1. Acces admin global

Page a ouvrir :

```text
/admin
```

Verifier :

- la page charge sans erreur serveur ;
- le token admin est requis ;
- les jobs existants sont visibles ;
- aucune action ne publie sans validation humaine.

### 2. Sources recuperees

Page a ouvrir :

```text
/admin/sources
```

Verifier :

- les `source_items` sont visibles ;
- les filtres provider / statut fonctionnent ;
- les actions humaines `selected`, `ignored`, `archived` restent disponibles ;
- aucune selection ne cree automatiquement de signal, job ou publication.

### 3. Signaux editoriaux

Page a ouvrir :

```text
/admin/signals
```

Verifier :

- les `editorial_signals` sont visibles ;
- la source rattachee est affichee ;
- les filtres statut / risque / categorie fonctionnent ;
- les actions `ignored`, `archived`, `ready_for_campaign` ne creent aucune publication ;
- la preparation de jobs exige une selection humaine de plateformes.

### 4. Vue groupee source / signal / jobs

Page a ouvrir :

```text
/admin/source-groups
```

Verifier :

- chaque groupe affiche le `sourceItem` ;
- les signaux rattaches sont visibles ;
- les jobs rattaches sont visibles ;
- la vue reste informative et ne declenche aucune action metier implicite.

## Smoke test generation controlee

Sur un job en statut :

```text
pending_review
```

ou :

```text
drafted
```

Verifier :

- le bouton de generation / reecriture est visible ;
- une instruction courte peut etre saisie ;
- `adapted_content` est mis a jour ;
- `source_content` reste conserve ;
- le statut du job ne change pas ;
- le job ne passe jamais automatiquement en `approved` ;
- aucune publication n est declenchee.

## Smoke test fallback mock LinkedIn

Configuration attendue par defaut :

```text
PUBLISHER_MODE=mock
```

Verifier :

- le worker demarre en mock ;
- les jobs approuves restent traites par le publisher mock ;
- aucun appel LinkedIn reel n est emis.

Si une fenetre de test reel est preparee, verifier que LinkedIn reel ne s arme pas sans confirmation runtime explicite documentee dans `docs/LINKEDIN_REAL_TEST_RUNBOOK.md`.

Apres toute fenetre de test reel, remettre immediatement :

```text
PUBLISHER_MODE=mock
```

puis redemarrer les services concernes.

## Validation finale

La verification staging est consideree comme OK si :

- les quatre pages admin chargeent ;
- la generation controlee fonctionne sans changement de statut ;
- aucun job ne passe automatiquement en `approved` ;
- aucune publication reelle n est declenchee ;
- le mode mock reste actif par defaut ;
- les logs ne contiennent aucun secret.

## Definition of Done

- Cette checklist existe.
- La PR reste strictement documentaire.
- RelayPress checks passent.

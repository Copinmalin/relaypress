# PR K - Consolidation qualite post-PR J

## Objectif

PR K est une PR strictement documentaire et operationnelle.

Elle ne doit ajouter aucune fonctionnalite, aucun endpoint, aucune migration et aucun comportement publisher.

Objectifs :

- verifier les PR ouvertes ;
- verifier les issues ouvertes ;
- relire `AGENTS.md`, `README.md` et `docs/MASTER_PROJECT_TRACKING.md` ;
- documenter une note de deploiement staging apres PR J ;
- confirmer que le mode mock reste le defaut sur.

## Etat GitHub verifie

Au lancement de PR K :

```text
PR ouvertes : aucune
Issues ouvertes : aucune
```

Une issue administrative accidentelle `#36` existe mais elle est fermee et marquee `not_planned`. Aucun travail projet ne lui est rattache.

## Branches temporaires

Des branches temporaires peuvent exister suite aux essais du connecteur GitHub. Le connecteur expose ne fournit pas d action de suppression de branche. Le nettoyage doit donc etre fait manuellement cote GitHub si souhaite.

La branche utile pour PR K est :

```text
pr-k-consolidation-qualite-6
```

## Note de deploiement staging post-PR J

Le mode permanent attendu en staging reste :

```text
PUBLISHER_MODE=mock
```

LinkedIn reel ne doit etre active que pendant une fenetre de test controlee, avec la confirmation runtime documentee dans `docs/LINKEDIN_REAL_TEST_RUNBOOK.md`.

Apres toute fenetre de test reel, remettre le mode mock et redemarrer les services concernes.

Pages admin a verifier apres deploiement :

```text
/admin
/admin/sources
/admin/signals
/admin/source-groups
```

Verifier aussi :

- la generation controlee ne change pas le statut des jobs ;
- aucun job ne passe automatiquement en `approved` ;
- aucune publication n est declenchee par la generation IA ;
- le publisher reel ne s arme pas sans confirmation runtime ;
- le worker revient au mock si la confirmation manque.

## Garde-fous confirmes

- Aucun token ajoute au depot.
- Aucun secret ajoute au depot.
- Aucun code applicatif modifie.
- Aucune publication automatique.
- Aucune validation automatique.
- Aucune integration Telegram comme publisher.

## Definition of Done

- `docs/MASTER_PROJECT_TRACKING.md` indique PR K comme phase en cours.
- Cette note de consolidation existe.
- La PR ne modifie pas le code applicatif.
- RelayPress checks passent avant merge.

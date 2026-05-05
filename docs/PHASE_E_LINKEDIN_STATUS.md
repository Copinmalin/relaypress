# RelayPress — Phase E LinkedIn

Date : 2026-05-05

Ce document complète le suivi projet. Le document de référence reste `docs/MASTER_PROJECT_TRACKING.md`.

## Statut

```txt
Phase E — Publisher réel LinkedIn
Statut : en cours
Activation staging : non
Mode staging recommandé : mock
```

## Incrément réalisé

```txt
- ajout de la configuration d’endpoint LinkedIn
- ajout du publisher LinkedIn UGC Posts
- activation uniquement par mode explicite
- mode mock conservé par défaut
- contrôle de disponibilité avant traitement
- refus des contenus LinkedIn vides
- récupération d’un identifiant externe depuis la réponse LinkedIn
- ajout d’une erreur typée publisher
- conservation des erreurs API nettoyées dans les runs
```

## Fichiers modifiés

```txt
services/worker/src/config.ts
services/worker/src/publisher/types.ts
services/worker/src/publisher/linkedin-publisher.ts
services/worker/src/publisher/index.ts
.env.example
docs/05_ROADMAP.md
```

## Décision

Le code du publisher LinkedIn réel est présent, mais le staging doit rester en mode mock tant qu’un test contrôlé n’est pas explicitement lancé.

## Prochaine étape

```txt
1. Finaliser le choix entre publication membre et page organisation.
2. Préparer un accès LinkedIn de test contrôlé.
3. Créer un brouillon LinkedIn de test dans l’admin.
4. Valider manuellement le job.
5. Activer temporairement le mode réel.
6. Observer les logs worker et les runs.
7. Revenir au mode mock après le test.
```

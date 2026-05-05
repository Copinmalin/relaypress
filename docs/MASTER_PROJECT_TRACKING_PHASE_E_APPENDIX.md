# RelayPress — Annexe de suivi Phase E LinkedIn

Date : 2026-05-05

Ce fichier annexe complète temporairement `docs/MASTER_PROJECT_TRACKING.md`, qui reste la source de vérité opérationnelle du projet.

## Statut

```txt
Phase E — Publisher réel LinkedIn
Statut : en cours
Activation staging : non
Mode staging recommandé : mock
```

## Incrément réalisé

```txt
- configuration LINKEDIN_API_BASE_URL
- publisher LinkedIn UGC Posts implémenté
- activation uniquement via PUBLISHER_MODE=linkedin_real
- PUBLISHER_MODE=mock conservé par défaut
- contrôle de disponibilité avant claim
- refus des contenus LinkedIn vides
- récupération d’un identifiant externe depuis la réponse LinkedIn
- ajout de PublisherPublishError
- conservation des erreurs API nettoyées dans publication_job_runs.raw_response
```

## Fichiers concernés

```txt
services/worker/src/config.ts
services/worker/src/publisher/types.ts
services/worker/src/publisher/linkedin-publisher.ts
services/worker/src/publisher/index.ts
.env.example
docs/05_ROADMAP.md
docs/PHASE_E_LINKEDIN_STATUS.md
```

## Décision

```txt
Le code du publisher LinkedIn réel est présent.
Le staging doit rester en PUBLISHER_MODE=mock tant qu’un test contrôlé n’est pas explicitement lancé.
```

## Prochaine étape

```txt
1. Finaliser le choix entre publication membre et page organisation.
2. Finaliser l’application LinkedIn Developer.
3. Définir l’URN auteur exact.
4. Préparer un accès contrôlé sur staging.
5. Créer un brouillon LinkedIn de test dans l’admin.
6. Valider manuellement le job.
7. Activer temporairement le mode réel.
8. Observer les logs worker et les runs.
9. Revenir au mode mock après le test.
```

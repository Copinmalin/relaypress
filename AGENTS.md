# RelayPress V0.2 — Instructions agents

## Doctrine
RelayPress V0.2 est un clean-room rebuild minimal.
La branche `v0.1.old` est l'archive historique et ne doit pas servir de modèle architectural par défaut.

Flux produit : `Karakeep → RelayPress → OpenAI → validation humaine → Postiz`.

## Priorité
Faire fonctionner le parcours utilisateur avec le moins de code, tables, services et abstractions possible.

## Ne pas ajouter sans besoin observé
- Redis
- queue
- worker séparé
- ORM
- framework frontend
- publisher social natif
- OAuth LinkedIn/Meta/X dans RelayPress
- scheduler social
- calendrier
- moteur RSS/scraping
- Flowise/Dify
- abstraction Provider générique
- traitement spécial de Nostr

## Données
Le modèle cible reste limité à : `users`, `workspaces`, `workspace_members`, `profiles`, `integrations`, `campaigns`, `variants`.
Toute nouvelle table doit être justifiée par une fonctionnalité utilisateur immédiate.

## Tests
Pendant la construction : contrôle syntaxique, migration base vide, smoke test du flux réel. Consolider ensuite d'abord l'isolation workspace, la séparation des profils, le bon mapping Postiz et l'anti-double soumission.

## Source de vérité
`README.md` décrit l'architecture active. Éviter de recréer une documentation parallèle volumineuse.

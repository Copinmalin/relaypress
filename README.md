# RelayPress V0.2

RelayPress est une interface éditoriale minimale :

Karakeep → RelayPress → OpenAI → validation humaine → Postiz → réseaux

La V0.1 historique est conservée dans `v0.1.old`. La V0.2 repart sur un socle volontairement petit.

## Architecture

- Node.js 24, HTTP natif
- PostgreSQL
- Karakeep pour l'inbox
- OpenAI pour la génération
- Postiz pour comptes, OAuth, programmation et publication

Pas de Redis, queue, worker séparé, ORM, framework frontend, calendrier social, moteur de veille ou couche IA intermédiaire.

## Modèle de données

`users`, `workspaces`, `workspace_members`, `profiles`, `integrations`, `campaigns`, `variants`.

## Flux MVP

1. choisir workspace + profil
2. choisir une source Karakeep ou saisir URL/texte
3. créer une campagne
4. donner éventuellement un angle
5. générer avec OpenAI
6. relire/corriger
7. envoyer un brouillon à Postiz

## Démarrage

```bash
cp .env.example .env
npm install
npm start
```

Ou :

```bash
docker compose up --build
```

Puis ouvrir `http://localhost:3000`.

## Principe directeur

RelayPress ne code que ce qui relie utilement un profil éditorial, une source, une génération et une destination de publication.

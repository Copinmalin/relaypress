# RelayPress — Vision projet

RelayPress est un système éditorial souverain piloté par Nostr.

Le projet ne vise pas seulement à relayer des notes Nostr vers des réseaux sociaux. Il vise à créer une infrastructure complète où les intentions éditoriales, les brouillons, les adaptations, les validations et les résultats de publication sont traçables et auditables.

## Thèse centrale

Les plateformes sociales propriétaires doivent être traitées comme des sorties de diffusion, pas comme la source de vérité.

La source de vérité doit rester sous contrôle de l’utilisateur : événements Nostr signés, relay souverain, règles éditoriales explicites, validation humaine et journal d’exécution indépendant.

## Formule d’architecture

```txt
Nostr = intention signée + journal souverain + plan de contrôle
Relay privé = registre canonique des événements éditoriaux
PostgreSQL = état métier opérationnel
Worker = moteur d’indexation, de transformation et de publication
API admin = pilotage éditorial humain
Publishers = sorties vers plateformes externes
IA = adaptation sous contraintes, plus tard
```

## État fonctionnel actuel

Le MVP actuel permet déjà le workflow suivant :

```txt
Nostr event ou brouillon manuel
→ création de jobs éditoriaux
→ adaptation minimale / déterministe selon plateforme
→ comparaison source originale / version adaptée
→ édition humaine
→ validation
→ publication mock
→ audit des exécutions
→ archivage non destructif
```

RelayPress ne publie pas encore réellement vers LinkedIn, X, Facebook ou Instagram. La couche de publisher réel LinkedIn est préparée, mais volontairement non connectée.

## Positionnement

RelayPress est :

- un orchestrateur éditorial ;
- un plan de contrôle Nostr-native ;
- un outil de préparation et validation humaine ;
- une couche d’adaptation par plateforme ;
- un système de publication multi-plateforme ;
- un journal d’audit souverain.

RelayPress n’est pas :

- un simple bot de repost ;
- un outil de scraping ;
- une ferme à spam ;
- un SaaS captif ;
- un outil qui publie réellement sans garde-fous ;
- un remplaçant de la responsabilité éditoriale humaine.

## Doctrine d’autonomie

L’autonomie doit porter sur l’exécution, pas sur la responsabilité éditoriale.

Niveaux visés :

1. L’humain écrit, RelayPress adapte et publie en mode contrôlé.
2. L’humain crée un brouillon ou une intention Nostr, RelayPress prépare les versions par plateforme.
3. L’humain valide, le worker exécute et journalise.
4. Plus tard, l’humain définit un scénario, l’IA rédige, l’humain valide.
5. Plus tard encore, RelayPress exécute automatiquement des contenus à faible risque dans un cadre explicite.

Le niveau autonome complet, où l’IA choisit seule les sujets, rédige et publie sans cadre, n’est pas l’objectif principal.

## Doctrine mock-first

Le mode `mock` n’est pas un bricolage provisoire. C’est une couche de sécurité produit.

Il permet de valider :

- l’état métier ;
- l’interface admin ;
- les transitions de statuts ;
- l’anti-doublon ;
- les retries ;
- les runs ;
- l’archivage ;
- l’audit complet.

Les publishers réels ne doivent être branchés qu’après durcissement OAuth, chiffrement des tokens, gestion fine des erreurs API et validation explicite.

## Principe souverain

RelayPress doit permettre à l’utilisateur de garder la maîtrise de son intention éditoriale, de ses règles, de ses archives et de son infrastructure.

Les plateformes restent des canaux. Elles ne doivent jamais devenir le système de commande.

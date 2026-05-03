# RelayPress — Vision projet

RelayPress est un système éditorial souverain piloté par Nostr.

Le projet ne vise pas seulement à relayer des notes Nostr vers des réseaux sociaux. Il vise à créer une infrastructure complète où les intentions éditoriales, les scénarios, les calendriers, les générations IA, les validations et les résultats de publication sont traçables et auditables.

## Thèse centrale

Les plateformes sociales propriétaires doivent être traitées comme des sorties de diffusion, pas comme la source de vérité.

La source de vérité doit rester sous contrôle de l’utilisateur : événements Nostr signés, relay souverain, règles éditoriales explicites, journal d’exécution indépendant.

## Positionnement

RelayPress est :

- un orchestrateur éditorial ;
- un plan de contrôle Nostr-native ;
- un moteur de scénarios et de campagnes ;
- une couche d’adaptation IA ;
- un système de publication multi-plateforme ;
- un journal d’audit souverain.

RelayPress n’est pas :

- un simple bot de repost ;
- un outil de scraping ;
- une ferme à spam ;
- un SaaS captif ;
- un remplaçant de la responsabilité éditoriale humaine.

## Doctrine d’autonomie

L’autonomie doit porter sur l’exécution, pas sur la responsabilité éditoriale.

Niveaux visés :

1. L’humain écrit, RelayPress adapte et publie.
2. L’humain définit un scénario, l’IA rédige, l’humain valide.
3. L’humain définit une campagne, RelayPress exécute automatiquement les contenus à faible risque.

Le niveau autonome complet, où l’IA choisit seule les sujets, rédige et publie sans cadre, n’est pas l’objectif principal.

## Formule d’architecture

```txt
Nostr = intention signée
Relay privé = registre canonique
PostgreSQL = état métier
Queue = moteur opérationnel
IA = adaptation sous contrainte
API sociales = sorties secondaires
```

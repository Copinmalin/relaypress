# Modèle d’événements Nostr

RelayPress utilise Nostr comme plan de contrôle et journal d’intention.

## Kinds standards envisagés

```txt
kind:1       note courte source
kind:30023   contenu long publié
kind:30024   brouillon long-form
kind:30078   configuration applicative
kind:31922   événement calendrier daté
kind:31923   événement calendrier horaire
kind:5000+   demande de job, inspirée NIP-90
kind:6000+   résultat de job, inspiré NIP-90
kind:7000    feedback de job, inspiré NIP-90
```

## Kinds applicatifs RelayPress

```txt
30420 scénario éditorial
30421 campagne éditoriale
30422 règle de publication
30423 profil de ton
30424 programme éditorial
50420 demande de génération IA
60420 résultat de génération IA
50421 demande de publication externe
60421 résultat de publication externe
```

Ces kinds doivent être vérifiés avant stabilisation publique pour éviter les collisions avec l’écosystème Nostr.

## Exemple de scénario éditorial

```json
{
  "kind": 30420,
  "tags": [
    ["d", "scenario:bitcoin-education-weekly"],
    ["name", "Bitcoin Education Weekly"],
    ["app", "relaypress"]
  ],
  "content": "{\"objective\":\"Produire un contenu hebdomadaire de pédagogie Bitcoin\",\"audience\":\"grand public intelligent\",\"tone\":\"clair, direct, pédagogique\",\"platforms\":[\"x\",\"linkedin\"],\"approvalMode\":\"required_for_new_claims\"}"
}
```

## Doctrine

Les événements Nostr expriment l’intention et la traçabilité. L’état opérationnel est stocké dans PostgreSQL.

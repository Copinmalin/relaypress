# PR C — API de qualification source → signal

Ce document trace le périmètre de la PR C.

Objectif : permettre à un humain de qualifier une source récupérée déjà sélectionnée en `EditorialSignal`, sans IA, sans campagne et sans publication.

---

## Périmètre prévu

Route API à ajouter :

```text
POST /source-items/:id/editorial-signals
```

La route doit :

1. vérifier `ADMIN_API_TOKEN` ;
2. charger le `SourceItem` par `id` ;
3. refuser si la source n'existe pas ;
4. refuser si la source n'est pas au statut `selected` ;
5. valider les champs de qualification ;
6. créer un `EditorialSignal` rattaché à `source_item_id` ;
7. retourner le signal créé.

---

## Corps attendu

```json
{
  "category": "opsec",
  "summaryInternal": "Résumé éditorial interne.",
  "editorialAngle": "Angle de traitement proposé.",
  "riskLevel": "medium",
  "primarySources": ["https://example.com/source"]
}
```

Champs obligatoires :

```text
category
summaryInternal
editorialAngle
```

Champs optionnels :

```text
riskLevel       = low | medium | high, medium par défaut
primarySources  = tableau d'URL ou références, vide par défaut
status          = qualified | needs_sources | ready_for_campaign, qualified par défaut
```

---

## Règles métier

- seule une source `selected` peut être qualifiée ;
- une source `new`, `ignored`, `archived` ou `failed` doit être refusée ;
- `primarySources` doit rester une liste courte de références ;
- le signal créé n'est pas un contenu publiable ;
- la création du signal ne doit pas créer de campagne ;
- la création du signal ne doit pas créer de `publication_jobs` ;
- la création du signal ne doit pas déclencher de publisher.

---

## Garde-fous

Interdits dans cette PR :

- génération IA ;
- création automatique de campagne ;
- création automatique de publication ;
- modification du worker publisher ;
- intégration Telegram ;
- scraping social ;
- stockage de secrets.

---

## Réponses attendues

### Succès

```text
201 Created
```

Retour :

```json
{
  "signal": {
    "id": "...",
    "sourceItemId": "...",
    "category": "opsec",
    "summaryInternal": "...",
    "editorialAngle": "...",
    "riskLevel": "medium",
    "status": "qualified",
    "primarySources": [],
    "metadata": {},
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### Source inexistante

```text
404 Not Found
```

### Source non sélectionnée

```text
409 Conflict
```

### Payload invalide

```text
400 Bad Request
```

---

## Prochaine étape après PR C

Créer une PR dédiée pour afficher les signaux dans l'admin, puis seulement ensuite préparer la création explicite de jobs depuis une source ou un signal avec sélection des plateformes.

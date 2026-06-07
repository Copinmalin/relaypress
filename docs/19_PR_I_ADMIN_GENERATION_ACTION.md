# PR I - Action admin de generation controlee

Ce document trace le perimetre de la PR I.

Objectif : ajouter un bouton dans la page admin des jobs pour declencher explicitement la generation controlee ajoutee en PR H.

---

## Action ajoutee

Sur un `publication_job`, afficher :

```text
Generer / reecrire
```

uniquement si le job est :

```text
pending_review
drafted
```

et s il n a pas :

```text
external_post_id
published_at
```

---

## Comportement

Le bouton demande une instruction courte via l interface admin puis appelle :

```text
POST /publication-jobs/:id/generate
```

avec :

```json
{
  "instruction": "Reecrire clairement sans publier ni approuver",
  "mode": "mock"
}
```

La page recharge ensuite les jobs pour afficher le nouveau `adapted_content`.

---

## Garde-fous

- aucun passage automatique en `approved` ;
- aucune publication ;
- aucune modification du worker publisher ;
- generation uniquement sur jobs non publies ;
- action explicite et humaine depuis l admin ;
- mode mock utilise par defaut depuis l interface.

---

## Prochaine etape

Auditer l ergonomie du flux complet puis finaliser le premier publisher reel controle, en priorite LinkedIn.
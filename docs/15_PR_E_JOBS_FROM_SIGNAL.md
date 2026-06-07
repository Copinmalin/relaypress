# PR E - Jobs depuis signal editorial

Ce document trace le perimetre de la PR E.

Objectif : permettre a un humain de preparer explicitement des `publication_jobs` depuis un `EditorialSignal` au statut `ready_for_campaign`, avec selection humaine des plateformes.

---

## API ajoutee

```text
POST /editorial-signals/:id/publication-jobs
```

Corps attendu :

```json
{
  "platforms": ["x", "linkedin"],
  "status": "pending_review"
}
```

Plateformes supportees :

```text
x
linkedin
facebook
instagram
```

Statuts autorises a la creation :

```text
pending_review
drafted
```

`pending_review` est le statut par defaut.

---

## Regles metier

La route doit :

1. verifier `ADMIN_API_TOKEN` ;
2. verifier que le signal existe ;
3. refuser tout signal qui n est pas `ready_for_campaign` ;
4. exiger au moins une plateforme supportee ;
5. creer un job par plateforme demandee ;
6. rattacher chaque job a `source_item_id` et `editorial_signal_id` ;
7. rester idempotente via un identifiant stable par signal et plateforme.

---

## Migration minimale

Champs ajoutes a `publication_jobs` :

```text
source_item_id
editorial_signal_id
```

Index ajoutes :

```text
publication_jobs_source_item_idx
publication_jobs_editorial_signal_idx
```

---

## Garde-fous

Interdits dans cette PR :

- generation IA ;
- publication automatique ;
- modification du worker publisher ;
- passage automatique en `approved` ;
- integration Telegram ;
- scraping social ;
- stockage de secrets.

Cette PR prepare seulement des jobs relisibles et validables humainement.

---

## Prochaine etape

Ajouter une action admin depuis `/admin/signals` ou une vue groupee source / signal / jobs pour declencher cette route sans appel API manuel.

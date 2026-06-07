# PR D - Admin editorial signals

Ce document trace le perimetre de la PR D.

Objectif : rendre les `editorial_signals` visibles et pilotables dans l admin, sans IA, sans campagne, sans `publication_jobs` et sans publication.

---

## Perimetre prevu

API a ajouter :

```text
GET  /editorial-signals
POST /editorial-signals/:id/archived
POST /editorial-signals/:id/ignored
POST /editorial-signals/:id/ready_for_campaign
```

Page admin a ajouter :

```text
/admin/signals
```

---

## Affichage attendu

La page admin doit afficher :

- les champs principaux du signal ;
- le statut ;
- le niveau de risque ;
- la categorie ;
- le resume interne ;
- l angle editorial ;
- les sources primaires ;
- la source rattachee (`source_item_id`) ;
- le titre de la source ;
- l URL canonique de la source ;
- le provider de la source.

---

## Filtres attendus

```text
status
riskLevel
category
```

La premiere version peut rester volontairement simple : affichage limite aux 100 derniers signaux.

---

## Actions autorisees

L admin peut uniquement changer le statut du signal vers :

```text
archived
ignored
ready_for_campaign
```

Ces actions servent au tri editorial.

Elles ne doivent pas creer de contenu publiable.

---

## Garde-fous

Interdits dans cette PR :

- generation IA ;
- creation automatique de campagne ;
- creation de `publication_jobs` ;
- publication reelle ou mock ;
- modification du worker publisher ;
- integration Telegram ;
- scraping social ;
- stockage de secrets.

---

## Prochaine etape apres PR D

Creer une PR dediee pour permettre de preparer explicitement des jobs depuis une source ou un signal, avec selection humaine des plateformes.

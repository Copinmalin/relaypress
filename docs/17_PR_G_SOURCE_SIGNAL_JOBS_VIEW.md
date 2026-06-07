# PR G - Vue groupee source / signal / jobs

Ce document trace le perimetre de la PR G.

Objectif : ajouter une vue admin groupee permettant de lire toute la chaine editoriale depuis une source, sans nouvelle action metier.

---

## API ajoutee

```text
GET /source-groups
```

Filtres disponibles :

```text
provider
status
order
limit
```

La reponse groupe :

```text
sourceItem
editorialSignals[]
publicationJobs[]
```

---

## Page admin ajoutee

```text
/admin/source-groups
```

La page affiche pour chaque source :

- titre ;
- provider ;
- statut source ;
- URL canonique ;
- extrait ;
- signaux editoriaux rattaches ;
- jobs rattaches.

---

## Garde-fous

- lecture seule ;
- aucune creation de signal ;
- aucune creation de job ;
- aucune IA ;
- aucune publication ;
- aucune modification du worker publisher.

---

## Prochaine etape

Passer a la generation IA controlee seulement apres validation de cette vue de suivi transverse.

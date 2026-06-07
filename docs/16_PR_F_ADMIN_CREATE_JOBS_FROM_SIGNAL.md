# PR F - Admin create jobs from signal

Ce document trace le perimetre de la PR F.

Objectif : ajouter dans `/admin/signals` une action humaine permettant de preparer des `publication_jobs` depuis un `EditorialSignal` deja `ready_for_campaign`.

---

## Fonction ajoutee

Dans la carte d un signal, si le signal est au statut :

```text
ready_for_campaign
```

l admin peut selectionner explicitement les plateformes :

```text
x
linkedin
facebook
instagram
```

puis choisir le statut initial :

```text
pending_review
drafted
```

L action appelle :

```text
POST /editorial-signals/:id/publication-jobs
```

---

## Garde-fous

- aucun job n est cree si aucune plateforme n est selectionnee ;
- aucun job n est approuve automatiquement ;
- aucune IA n est declenchee ;
- aucune publication n est declenchee ;
- le worker publisher n est pas modifie ;
- l action reste protegee par le token admin deja utilise par la page.

---

## Prochaine etape

Ajouter une vue groupee source / signal / jobs pour suivre toute la chaine editoriale sans devoir naviguer entre plusieurs pages.

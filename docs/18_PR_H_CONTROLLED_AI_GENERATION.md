# PR H - Generation IA controlee

Ce document trace le perimetre de la PR H.

Objectif : ajouter un endpoint explicite permettant de generer ou reecrire `adapted_content` sur un `publication_job` existant, sans publication automatique et sans validation automatique.

---

## API ajoutee

```text
POST /publication-jobs/:id/generate
```

Corps optionnel :

```json
{
  "instruction": "Rendre le texte plus professionnel et plus court.",
  "mode": "mock"
}
```

Modes :

```text
mock   = mode par defaut, deterministic adapter local
openai = utilise OPENAI_API_KEY si presente, sinon fallback mock
```

---

## Regles metier

La route doit :

1. verifier `ADMIN_API_TOKEN` ;
2. verifier que le job existe ;
3. refuser tout job publie ou deja rattache a un `external_post_id` ;
4. limiter la generation aux statuts :

```text
pending_review
drafted
```

5. conserver `source_content` ;
6. reecrire uniquement `adapted_content` ;
7. ne jamais passer le job en `approved` ;
8. ne jamais publier ;
9. conserver les avertissements dans `error_message`.

---

## Garde-fous

- aucune publication automatique ;
- aucun passage automatique en `approved` ;
- aucun changement du worker publisher ;
- aucun token ajoute au depot ;
- fallback mock si aucune cle IA n est disponible ;
- generation uniquement declenchee par appel admin explicite.

---

## Prochaine etape

Ajouter une action admin visible depuis la page jobs pour declencher cette generation sans appel API manuel, puis auditer l ergonomie avant tout branchement IA plus avance.

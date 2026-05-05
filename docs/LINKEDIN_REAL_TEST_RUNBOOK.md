# RelayPress — Runbook de test LinkedIn réel contrôlé

Date : 2026-05-05

Ce runbook décrit la prochaine étape de la Phase E : tester le publisher LinkedIn réel dans une fenêtre courte, contrôlée et réversible.

Le staging doit rester en mode `mock` par défaut.

---

## 1. Objectif

Valider que RelayPress peut publier un job LinkedIn approuvé vers LinkedIn via le publisher réel, tout en conservant :

```txt
- validation humaine obligatoire
- un seul job de test
- observation des logs worker
- conservation du run dans publication_job_runs
- retour immédiat au mode mock après test
```

---

## 2. Préconditions

Avant de lancer le test réel :

```txt
✅ CI verte
✅ staging redéployé
✅ API health ok
✅ admin accessible
✅ PUBLISHER_MODE=mock par défaut
✅ compte ou page LinkedIn contrôlé
✅ application LinkedIn Developer prête
✅ URN auteur exact connu
✅ accès LinkedIn de test disponible uniquement sur le serveur staging
```

Ne jamais commiter de valeur d’accès LinkedIn dans le dépôt.

---

## 3. Vérifier l’état staging

```bash
cd /opt/relaypress

git pull --ff-only
docker compose ps
curl -s https://api.relaypress.copinmalin.top/health | jq

grep '^PUBLISHER_MODE=' .env
```

Résultat attendu :

```txt
PUBLISHER_MODE=mock
```

---

## 4. Préparer le brouillon de test

Depuis l’admin :

```txt
https://api.relaypress.copinmalin.top/admin
```

Créer un brouillon manuel LinkedIn uniquement.

Contenu recommandé :

```txt
Test technique RelayPress.

Publication contrôlée depuis le staging pour valider le connecteur LinkedIn réel.
```

Vérifier :

```txt
- plateforme : linkedin uniquement
- statut initial : pending_review
- contenu relu manuellement
- aucun autre job approved en attente
```

---

## 5. Vérifier les jobs avant activation

```bash
cd /opt/relaypress
export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"

curl -s \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://api.relaypress.copinmalin.top/publication-jobs?view=todo&platform=linkedin&order=desc" | jq
```

Il doit y avoir un seul job LinkedIn prévu pour le test.

---

## 6. Approuver le job dans l’admin

Dans l’admin :

```txt
- ouvrir le job LinkedIn de test
- relire le contenu adapté
- approuver uniquement ce job
```

Ne pas approuver d’autre job pendant la fenêtre de test.

---

## 7. Activer temporairement le mode réel

Avant modification :

```bash
cd /opt/relaypress
cp .env .env.before-linkedin-test
```

Éditer `.env` sur le serveur staging :

```bash
nano .env
```

Renseigner uniquement sur le serveur :

```txt
PUBLISHER_MODE=linkedin_real
LINKEDIN_API_BASE_URL=https://api.linkedin.com/v2
LINKEDIN_AUTHOR_URN=<urn auteur contrôlé>
LINKEDIN_ACCESS_TOKEN=<valeur fournie par LinkedIn Developer>
```

Ne pas copier ces valeurs dans GitHub, Slack, notes publiques ou capture d’écran.

Redémarrer uniquement le worker :

```bash
docker compose up -d --build worker
```

---

## 8. Observer l’exécution

```bash
docker compose logs -f worker
```

Résultat attendu :

```txt
status published
component linkedin-publisher
platform linkedin
externalPostId linkedin:...
```

Si erreur :

```txt
status failed
raw_response renseignée dans publication_job_runs
aucun secret dans les logs
```

---

## 9. Contrôler le run

```bash
cd /opt/relaypress
export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2-)"

curl -s \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://api.relaypress.copinmalin.top/publication-jobs?platform=linkedin&order=desc&limit=5" | jq
```

Puis ouvrir les runs du job depuis l’admin ou via l’endpoint dédié.

À vérifier :

```txt
- status du job
- external_post_id
- publication_job_runs.status
- publication_job_runs.raw_response
- absence de secret dans raw_response
```

---

## 10. Revenir immédiatement en mode mock

Restaurer le mode sûr :

```bash
cd /opt/relaypress
cp .env.before-linkedin-test .env
docker compose up -d --build worker

grep '^PUBLISHER_MODE=' .env
```

Résultat attendu :

```txt
PUBLISHER_MODE=mock
```

---

## 11. Clôture du test

Documenter le résultat dans `docs/MASTER_PROJECT_TRACKING_PHASE_E_APPENDIX.md` ou dans une nouvelle note datée :

```txt
- date du test
- compte ou page cible sans données sensibles
- job id
- run id
- statut final
- external_post_id si succès
- erreur nettoyée si échec
- décision : continuer / corriger / durcir avant nouveau test
```

---

## 12. Règle de sécurité finale

Le mode réel LinkedIn ne doit jamais rester actif après le test.

Mode permanent attendu sur staging :

```txt
PUBLISHER_MODE=mock
```

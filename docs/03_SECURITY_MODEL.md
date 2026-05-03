# Modèle de sécurité

RelayPress manipule des éléments sensibles : identité Nostr, tokens OAuth, calendrier éditorial, générations IA et droits de publication externe.

## Principes

- Ne jamais stocker de clé privée Nostr principale en clair.
- Chiffrer les tokens OAuth au repos.
- Utiliser les API officielles des plateformes.
- Refuser le scraping et les automatisations de navigateur fragiles.
- Journaliser les actions sans exposer les secrets.
- Séparer l’intention, la validation et l’exécution.

## Nostr

Pour les signatures Nostr, la cible à terme est NIP-46 ou un signer externe.

RelayPress ne doit pas devenir un coffre à `nsec`.

## OAuth

Les connexions aux plateformes externes doivent prévoir :

- stockage chiffré ;
- refresh token quand disponible ;
- révocation ;
- expiration ;
- limitation de périmètre ;
- journalisation des erreurs.

## IA

L’IA doit être encadrée par un Policy Engine.

Les contenus suivants exigent une validation humaine :

- contenu politique ;
- affirmation chiffrée ou statistique ;
- sponsor ou partenariat ;
- conseil financier ;
- contenu polémique ;
- image générée destinée à publication publique.

## Publication

Chaque publication externe doit être idempotente et traçable.

RelayPress doit éviter :

- les doublons ;
- les retries infinis ;
- la publication d’un ancien job devenu obsolète ;
- la publication si OAuth est expiré ;
- la publication si le contenu dépasse les contraintes de plateforme.

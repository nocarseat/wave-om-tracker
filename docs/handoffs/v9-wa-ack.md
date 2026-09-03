# v9 : accusé de réception et silence interdit (03/09/2026)

- Une image reçue sur WhatsApp déclenche tout de suite « Je lis ton image, réponse dans quelques secondes. »
  avant le traitement asynchrone.
- Si la journalisation du message échoue (autre chose qu'un doublon), le bot répond quand même par un message
  d'erreur générique et l'erreur est écrite dans les logs Netlify. Cause réelle observée en test : migration
  003_wa_async.sql non appliquée, d'où des messages rejetés sans aucune réponse.
Aucun changement de schéma.

# v7 : canal WhatsApp (03/09/2026)

Nouveau : un numéro WhatsApp (Meta Cloud API) qui reçoit et comprend :
- un SMS Wave / Orange Money transféré -> enregistré, réponse avec le bilan du mois
- "1500 taxi", "2500 pain om", "+50000 salaire" -> saisie rapide (src/lib/quicklog.ts)
- une capture d'historique ou une photo de reçu -> Claude lit, tout est enregistré (dédup), ANNULER retire l'import
- une question libre -> Claude répond en 1 à 3 phrases avec le résumé du mois en contexte (src/lib/summary.ts)
- AIDE, BILAN, SITE (lien de connexion sans mot de passe vers le tableau de bord), LIER 123456 (rattache le
  numéro à un compte web ; le code se génère dans Réglages)
Un numéro inconnu reçoit un compte créé à la volée (email synthétique @wa.sama-depenses.app). Les vocaux ne sont
pas encore traités (réponse d'attente).

Technique : route GET/POST /api/whatsapp/webhook (vérification Meta, signature X-Hub-Signature-256 si
WHATSAPP_APP_SECRET, dédup par wa_messages.wa_message_id, toujours 200). Envoi isolé dans src/lib/whatsapp/cloud.ts
(remplaçable par WATI). Migration : supabase/migrations/002_whatsapp.sql (profiles.wa_phone, pairing_code,
table wa_messages). Réglages : section WhatsApp (numéro du bot, bouton « Lier mon WhatsApp », délier).

Limites connues : traitement synchrone dans le webhook (une image lue par Claude prend 5 à 10 s ; le timeout
fonction Netlify est de 10 s par défaut, à surveiller) ; pas de fusion de comptes si un numéro auto-créé est
ensuite lié à un compte web (l'auto-créé est simplement délié).

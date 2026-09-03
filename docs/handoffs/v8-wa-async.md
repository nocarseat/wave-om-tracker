# v8 : WhatsApp asynchrone, erreurs lisibles, Wave en anglais (03/09/2026)

Constat : une capture d'écran envoyée sur WhatsApp ne recevait aucune réponse. Deux causes possibles observées :
crédit Anthropic à zéro (erreur 400 "credit balance too low") et fonction Netlify tuée à ~10 s avant d'avoir répondu.

Changements :
- Le webhook ne traite plus rien : il journalise le message (nouvelles colonnes profile_name, media_id, mime_type,
  caption, attempts) et déclenche POST /api/whatsapp/process (header x-internal-token = WHATSAPP_VERIFY_TOKEN)
  sans attendre. Verrou optimiste sur status received -> processing.
- Les appels Claude côté WhatsApp utilisent CLAUDE_FAST_MODEL (défaut claude-haiku-4-5-20251001), plus rapide.
- Erreurs expliquées à l'utilisateur : crédit IA épuisé, image irrécupérable, sinon message générique. Une question
  libre sans IA disponible renvoie quand même le BILAN chiffré.
- Parseur SMS : formulations anglaises de Wave (Sent to, Received from, Bought airtime, New balance, montants 20.200F).
  Tests : 11/11.
- README : étapes Meta manquantes (numéro destinataire, abonnement de l'app au WABA via subscribed_apps).

Migration : supabase/migrations/003_wa_async.sql. Aucune nouvelle variable d'environnement obligatoire.

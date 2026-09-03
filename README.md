# Sama Dépenses

Suivi des dépenses Wave et Orange Money (Sénégal). Web app mobile-first installable sur le téléphone.

## Mise en route (une seule fois)

1. **Supabase** : créez un projet sur supabase.com, ouvrez SQL Editor, collez tout `supabase/schema.sql`, Run.
   Dans Authentication > Providers > Email, désactivez « Confirm email » pour tester sans boîte mail.
2. **Clés** : copiez `.env.example` vers `.env.local` et remplissez `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (Project Settings > API Keys) et `ANTHROPIC_API_KEY`.
3. `npm install` puis `npm run dev`. Ouvrez http://localhost:3000, créez un compte.

## Tester sur le téléphone

- **En local** : PC et téléphone sur le même Wi-Fi, lancez `npm run dev -- -H 0.0.0.0`, puis ouvrez
  `http://<IP-du-PC>:3000` sur le téléphone (`ipconfig` dans Git Bash pour l'IP, ligne IPv4 du Wi-Fi).
- **En ligne** : poussez le repo sur GitHub, importez-le dans Netlify (Add new project > Import from Git),
  ajoutez les 4 variables d'environnement dans Site configuration > Environment variables, déployez.
  Sur le téléphone, ouvrez l'URL Netlify puis « Ajouter à l'écran d'accueil ».

## Capture automatique des SMS (Android)

Réglages dans l'app : l'adresse du webhook et votre jeton y sont affichés, avec la marche à suivre MacroDroid.
Le webhook attend `POST /api/ingest/sms` avec le header `x-ingest-token` et un JSON `{ "sender": "...", "body": "..." }`.

## Scripts

- `npm run dev` : développement
- `npm run build` : build de production (à lancer avant de pousser)
- `npm run test:sms` : teste le parseur SMS sur les exemples de `src/lib/sms.samples.ts`

## WhatsApp (Meta Cloud API)

1. developers.facebook.com > My Apps > Create app (type Business) > ajouter le produit WhatsApp.
2. WhatsApp > API Setup : notez le **Phone number ID** et le **numéro de test** ; ajoutez votre propre numéro
   dans « To » (code de vérification reçu sur WhatsApp). Le jeton temporaire dure 24 h ; pour un jeton permanent :
   Business Settings > System users > Add > Generate token (permission whatsapp_business_messaging).
3. WhatsApp > Configuration > Webhook : Callback URL `https://<votre-site>/api/whatsapp/webhook`,
   Verify token = la valeur de `WHATSAPP_VERIFY_TOKEN`, puis Subscribe au champ **messages**.
4. Variables : `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `NEXT_PUBLIC_WHATSAPP_NUMBER`,
   `NEXT_PUBLIC_SITE_URL` (et `WHATSAPP_APP_SECRET` si vous voulez vérifier les signatures). Redéployez.
5. Exécutez `supabase/migrations/002_whatsapp.sql` dans le SQL Editor (projets créés avant v7).
6. Test : envoyez AIDE au numéro de test depuis votre WhatsApp.

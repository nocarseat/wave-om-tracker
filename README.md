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

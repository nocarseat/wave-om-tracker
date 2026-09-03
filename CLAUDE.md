@AGENTS.md

# Sama Dépenses (wave-om-tracker)

Suivi des dépenses personnelles pour le Sénégal, limité à Wave et Orange Money.
Web app mobile-first (PWA), vibe-codée avec Claude Code. Langue de l'interface : français.
Commentaires de code en français, conversation avec le développeur en anglais.

## Stack
- Next.js 16 (App Router, `src/`, Turbopack), React 19, TypeScript, Tailwind 4
- Supabase : Postgres + Auth (email/mot de passe) + RLS. Schéma dans `supabase/schema.sql`
- Anthropic SDK (`claude-sonnet-5` par défaut, variable `CLAUDE_MODEL`) pour lire captures d'écran et reçus
- Hébergement Netlify (`netlify.toml`), déploiement par `git push` sur `main`

## Comment l'argent entre dans l'app
1. SMS Wave / Orange Money -> `POST /api/ingest/sms` (jeton `x-ingest-token` du profil) -> `src/lib/sms.ts`
2. Texte de SMS collé dans Opérations -> même parseur
3. Capture d'écran ou photo de reçu -> `POST /api/parse-image` -> Claude renvoie un JSON -> l'utilisateur confirme -> `saveImported`
4. Saisie manuelle

Toute insertion passe par `recordParsedTx` (`src/lib/ingest.ts`) : rattachement au compte, catégorie
(règle apprise `merchant_rules` > mots-clés `src/lib/categories.ts` > défaut par type), déduplication par `fingerprint`.

## Conventions
- Montants en XOF entiers (`numeric(14,0)`), affichés avec `fcfa()` : `12 500 F`
- Pas de tirets cadratins dans les textes de l'interface
- Chaque table a `user_id` et une policy RLS `auth.uid() = user_id`. Le client admin (`SUPABASE_SECRET_KEY`) ne sert qu'au webhook SMS
- Server Actions dans `actions.ts` à côté de la page ; composants client dans `src/components/`
- Ne jamais définir `temperature` sur les appels Claude (Sonnet 5 renvoie 400)

## Commandes
- `npm run dev` puis ouvrir http://localhost:3000 (sur le téléphone : http://<IP du PC>:3000, même Wi-Fi)
- `npm run build` avant chaque push
- `npm run test:sms` teste le parseur sur `src/lib/sms.samples.ts` (remplacer par de vrais SMS)

## Prochaines étapes envisagées
- Affiner les regex SMS avec de vrais messages (voir `inbound_sms` status ignored/error)
- Catégorisation par Claude quand ni règle ni mot-clé ne matche
- Recommandations de budget rédigées par Claude à partir des moyennes
- Alertes à 80 % du budget (WhatsApp via WATI, ou notification web)
- App compagnon Android native pour remplacer MacroDroid

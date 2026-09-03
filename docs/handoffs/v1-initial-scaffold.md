# v1 : scaffold initial (03/09/2026)

Livré : schéma Supabase (7 tables + RLS + trigger de signup), auth email/mot de passe,
tableau de bord (total du mois, bande Wave/OM, catégories vs budgets, dernières opérations),
page Opérations (collage de SMS, saisie manuelle, changement de catégorie appris, suppression),
page Importer (capture ou reçu -> Claude -> confirmation), page Budgets (suggestion = moyenne 3 mois),
page Réglages (jeton + webhook + guide MacroDroid), webhook `POST /api/ingest/sms`, PWA (manifest + icônes).

Parseur SMS testé sur 8 formats approximatifs (8/8). Les vrais formats Wave / Orange Money doivent
être confirmés avec des SMS réels : coller quelques SMS dans `src/lib/sms.samples.ts` puis `npm run test:sms`.

Non fait : catégorisation par Claude en dernier recours, recommandations rédigées, alertes, app Android native.

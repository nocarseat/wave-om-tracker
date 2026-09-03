# v3 : scanner de secrets Netlify (03/09/2026)

Le premier déploiement Git a échoué avec "Exposed secrets detected". Causes : la clé publique Supabase
inlinée dans le bundle navigateur (comportement normal de NEXT_PUBLIC_*) et les exemples de clés dans .env.example.

Changements :
- netlify.toml : SECRETS_SCAN_OMIT_KEYS (clés publiques) et SECRETS_SCAN_OMIT_PATHS (.env.example, README, docs)
- .env.example : valeurs vides avec commentaires, plus de motifs ressemblant à des clés
- Côté projet Netlify (via CLI, hors repo) : SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES = valeurs publiques Supabase

Aucun changement de code applicatif. Le zip v3 ne contient plus .env.local pour ne pas écraser les vraies clés.

# v2 : configuration Netlify (03/09/2026)

Changement unique : `netlify.toml` ne référence plus `@netlify/plugin-nextjs`. Netlify applique
lui-même le dernier adaptateur OpenNext quand il détecte Next.js ; le bloc [[plugins]] figeait l'ancien runtime.
Aucune modification de code applicatif par rapport à v1.

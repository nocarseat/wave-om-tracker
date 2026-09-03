# v4 : cache Turbopack exclu du scanner de secrets (03/09/2026)

Le build v3 compilait, mais le scanner Netlify trouvait la valeur de ANTHROPIC_API_KEY dans
.netlify/.next/cache/turbopack/*.sst : le cache persistant de Turbopack enregistre l'environnement de
compilation. Ce dossier n'est jamais déployé. Ajout de .netlify/.next/cache/** et .next/cache/** à
SECRETS_SCAN_OMIT_PATHS dans netlify.toml. Aucun autre changement.

# v5 : liens de confirmation d'email (03/09/2026)

Problème : le lien de confirmation Supabase renvoyait vers localhost:3000 (Site URL par défaut).
- Nouvelle route GET /auth/callback : échange le code PKCE contre une session puis redirige vers l'app
- L'inscription passe emailRedirectTo = <origine>/auth/callback
- Le proxy redirige "/?code=..." vers /auth/callback (couvre le cas Site URL par défaut) et laisse
  /auth/callback accessible sans session
- Page de connexion : message si le lien n'est plus valide (?error=confirmation)

Côté Supabase (Authentication > URL Configuration) : Site URL = https://sama-depenses.netlify.app,
Redirect URLs = https://sama-depenses.netlify.app/**

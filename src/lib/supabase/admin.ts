import { createClient } from "@supabase/supabase-js";

// Client "service role" : contourne la RLS. Utilisé UNIQUEMENT côté serveur
// (webhook SMS) après vérification du jeton d'ingestion. Ne jamais l'exposer.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SECRET_KEY ou NEXT_PUBLIC_SUPABASE_URL manquant");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

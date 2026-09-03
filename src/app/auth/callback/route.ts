import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Cible des liens de confirmation d'email envoyés par Supabase (flux PKCE) :
// échange le code contre une session, puis renvoie vers l'app.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Derrière Netlify, l'origine publique est dans x-forwarded-host
  const forwardedHost = request.headers.get("x-forwarded-host");
  const base = forwardedHost ? `https://${forwardedHost}` : origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${base}${next}`);
  }
  return NextResponse.redirect(`${base}/login?error=confirmation`);
}

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractMessages, sendText, verifySignature } from "@/lib/whatsapp/cloud";

/*
 * Webhook WhatsApp (Meta Cloud API).
 *   GET  : vérification lors de la configuration du webhook côté Meta
 *   POST : messages entrants. On journalise, on déclenche le traitement dans une
 *          invocation séparée (/api/whatsapp/process) et on répond 200 tout de suite :
 *          les fonctions Netlify sont limitées à ~10 s, une capture lue par Claude peut
 *          dépasser ce délai, et Meta relance le webhook si on tarde à répondre.
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Jeton de vérification invalide" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const messages = extractMessages(payload);
  if (messages.length === 0) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const base = publicOrigin(request);
  const kicks: Promise<unknown>[] = [];

  for (const msg of messages) {
    if (!msg.id || !msg.from) continue;

    // Déduplication : Meta renvoie le même message tant qu'il n'a pas eu de 200
    const { data: log, error } = await admin
      .from("wa_messages")
      .insert({
        wa_from: msg.from,
        wa_message_id: msg.id,
        type: msg.type,
        body: msg.text ?? null,
        profile_name: msg.profileName,
        media_id: msg.mediaId,
        mime_type: msg.mimeType,
        caption: msg.caption,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      // 23505 = message déjà journalisé (relance Meta) : on ignore en silence.
      // Toute autre erreur (colonne manquante, base indisponible) : on prévient l'utilisateur
      // au lieu de se taire, et on la rend visible dans les logs Netlify.
      if (error.code !== "23505") {
        console.error("wa_messages insert failed", error.message);
        kicks.push(sendText(msg.from, "Oups, un souci technique de mon côté. Réessaie dans quelques minutes ou envoie AIDE.").catch(() => undefined));
      }
      continue;
    }
    if (!log) continue;

    // Accusé de réception immédiat pour ce qui prend du temps (lecture d'image par Claude)
    if (msg.type === "image") {
      kicks.push(sendText(msg.from, "Je lis ton image, réponse dans quelques secondes.").catch(() => undefined));
    }

    // Lancement du traitement dans une invocation séparée, sans attendre sa réponse
    kicks.push(
      fetch(`${base}/api/whatsapp/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-token": process.env.WHATSAPP_VERIFY_TOKEN ?? "" },
        body: JSON.stringify({ id: log.id }),
      }).catch(() => undefined)
    );
  }

  // On laisse ~2,5 s aux accusés de réception et aux requêtes de traitement pour partir, puis on répond à Meta
  await Promise.race([Promise.allSettled(kicks), new Promise((r) => setTimeout(r, 2500))]);
  return NextResponse.json({ ok: true });
}

function publicOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return host ? `https://${host}` : new URL(request.url).origin;
}

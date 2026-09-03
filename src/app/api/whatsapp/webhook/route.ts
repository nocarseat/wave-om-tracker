import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractMessages, markRead, sendText, verifySignature } from "@/lib/whatsapp/cloud";
import { handleInbound } from "@/lib/whatsapp/handler";

/*
 * Webhook WhatsApp (Meta Cloud API).
 *   GET  : vérification lors de la configuration du webhook côté Meta
 *   POST : messages entrants. On répond 200 quoi qu'il arrive pour éviter les relances,
 *          et on déduplique via wa_messages.wa_message_id.
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

  for (const msg of messages) {
    if (!msg.id || !msg.from) continue;

    // Déduplication : Meta renvoie le même message si on tarde à répondre
    const { data: log, error } = await admin
      .from("wa_messages")
      .insert({ wa_from: msg.from, wa_message_id: msg.id, type: msg.type, body: msg.text ?? msg.caption ?? null })
      .select("id")
      .maybeSingle();
    if (error || !log) continue;

    void markRead(msg.id);

    try {
      const result = await handleInbound(admin, msg);
      await sendText(msg.from, result.reply);
      await admin
        .from("wa_messages")
        .update({ user_id: result.userId, status: result.status, reply: result.reply })
        .eq("id", log.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "erreur inconnue";
      await admin.from("wa_messages").update({ status: "error", reply: message }).eq("id", log.id);
      try {
        await sendText(msg.from, "Oups, je n'ai pas réussi à traiter ce message. Réessaie dans un instant ou envoie AIDE.");
      } catch {
        // rien de plus à faire
      }
    }
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markRead, sendText, type InboundMessage } from "@/lib/whatsapp/cloud";
import { handleInbound } from "@/lib/whatsapp/handler";

/*
 * Traite UN message WhatsApp journalisé (appelé par le webhook, sans attente).
 * Protégé par le header x-internal-token (= WHATSAPP_VERIFY_TOKEN).
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("x-internal-token") !== process.env.WHATSAPP_VERIFY_TOKEN) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });

  const admin = createAdminClient();

  // Verrou optimiste : une seule invocation traite un message donné
  const { data: row } = await admin
    .from("wa_messages")
    .update({ status: "processing" })
    .eq("id", id)
    .eq("status", "received")
    .select("id, wa_from, wa_message_id, type, body, profile_name, media_id, mime_type, caption, attempts")
    .maybeSingle();
  if (!row) return NextResponse.json({ ok: true, skipped: true });

  const msg: InboundMessage = {
    id: row.wa_message_id,
    from: row.wa_from,
    profileName: row.profile_name,
    type: row.type as InboundMessage["type"],
    text: row.body,
    mediaId: row.media_id,
    mimeType: row.mime_type,
    caption: row.caption,
  };

  void markRead(msg.id);

  try {
    const result = await handleInbound(admin, msg);
    await sendText(msg.from, result.reply);
    await admin
      .from("wa_messages")
      .update({ user_id: result.userId, status: result.status, reply: result.reply, attempts: row.attempts + 1 })
      .eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "erreur inconnue";
    await admin
      .from("wa_messages")
      .update({ status: "error", reply: message, attempts: row.attempts + 1 })
      .eq("id", id);
    try {
      await sendText(msg.from, userFacingError(message));
    } catch {
      // rien de plus à faire
    }
    return NextResponse.json({ ok: false, error: message });
  }
}

// Message clair pour l'utilisateur selon la cause, sans exposer les détails techniques
function userFacingError(message: string): string {
  if (/credit balance|billing/i.test(message)) {
    return "La lecture d'images et les questions libres sont indisponibles pour le moment (service IA en pause). Les SMS transférés et les saisies comme « 1500 taxi » fonctionnent normalement.";
  }
  if (/media/i.test(message)) {
    return "Je n'ai pas pu récupérer l'image. Renvoie-la, ou envoie le SMS Wave ou Orange Money à la place.";
  }
  return "Oups, je n'ai pas réussi à traiter ce message. Réessaie dans un instant ou envoie AIDE.";
}

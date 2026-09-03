import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordParsedTx } from "@/lib/ingest";
import { parseSms } from "@/lib/sms";

/*
 * Webhook d'ingestion SMS.
 * Appelé par une app Android (MacroDroid, SMS Forwarder, ou une future app compagnon)
 * à chaque SMS reçu de Wave / Orange Money.
 *
 * POST /api/ingest/sms
 *   Header  x-ingest-token: <jeton visible dans Réglages>   (ou Authorization: Bearer <jeton>, ou champ "token")
 *   Body JSON : { "sender": "Wave", "body": "Vous avez envoyé 5,000F à ...", "received_at": "2026-09-03T15:22:00Z" }
 *   Body form-urlencoded accepté aussi (sender, body, received_at, token).
 */
export async function POST(request: NextRequest) {
  const payload = await readPayload(request);
  const token =
    request.headers.get("x-ingest-token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    payload.token;

  if (!token) return NextResponse.json({ error: "Jeton manquant" }, { status: 401 });
  if (!payload.body) return NextResponse.json({ error: "Champ body manquant" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("ingest_token", token)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Jeton invalide" }, { status: 401 });

  const receivedAt = payload.received_at ? new Date(payload.received_at) : new Date();
  const safeReceivedAt = Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt;

  const { data: log } = await admin
    .from("inbound_sms")
    .insert({
      user_id: profile.id,
      sender: payload.sender ?? null,
      body: payload.body,
      received_at: safeReceivedAt.toISOString(),
    })
    .select("id")
    .single();

  const parsed = parseSms(payload.sender, payload.body);
  if (!parsed) {
    await admin.from("inbound_sms").update({ status: "ignored" }).eq("id", log?.id);
    return NextResponse.json({ status: "ignored", reason: "SMS non reconnu" });
  }

  const result = await recordParsedTx(admin, profile.id, parsed, {
    source: "sms",
    rawText: payload.body,
    receivedAt: safeReceivedAt,
  });

  await admin
    .from("inbound_sms")
    .update({
      status: result.status === "inserted" ? "parsed" : result.status,
      transaction_id: result.status === "inserted" ? result.id : null,
      error: result.status === "error" ? result.message : null,
    })
    .eq("id", log?.id);

  return NextResponse.json({ status: result.status, parsed });
}

// Permet de vérifier depuis un navigateur que l'endpoint est bien déployé
export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST un SMS ici avec le header x-ingest-token" });
}

async function readPayload(request: NextRequest): Promise<{
  token?: string;
  sender?: string;
  body?: string;
  received_at?: string;
}> {
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) return await request.json();
    if (type.includes("form")) {
      const form = await request.formData();
      return Object.fromEntries(
        Array.from(form.entries()).map(([k, v]) => [k, String(v)])
      );
    }
    // Texte brut : on considère que tout est le corps du SMS
    const text = await request.text();
    try {
      return JSON.parse(text);
    } catch {
      return { body: text };
    }
  } catch {
    return {};
  }
}

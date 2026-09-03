import { createHmac, timingSafeEqual } from "crypto";

/*
 * Couche d'envoi WhatsApp : Meta WhatsApp Cloud API.
 * Isolée pour pouvoir brancher un autre fournisseur (WATI, 360dialog) plus tard.
 *
 * Variables d'environnement :
 *   WHATSAPP_TOKEN            jeton d'accès (System User, permanent)
 *   WHATSAPP_PHONE_NUMBER_ID  identifiant du numéro (WhatsApp > API Setup)
 *   WHATSAPP_VERIFY_TOKEN     chaîne choisie par vous, saisie dans la config du webhook Meta
 *   WHATSAPP_APP_SECRET       optionnel, "App secret" de l'app Meta pour vérifier les signatures
 *   WHATSAPP_GRAPH_VERSION    optionnel, par défaut v23.0
 */

const VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;

function token() {
  const t = process.env.WHATSAPP_TOKEN;
  if (!t) throw new Error("WHATSAPP_TOKEN manquant");
  return t;
}

function phoneNumberId() {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!id) throw new Error("WHATSAPP_PHONE_NUMBER_ID manquant");
  return id;
}

export async function sendText(to: string, body: string): Promise<void> {
  const res = await fetch(`${GRAPH}/${phoneNumberId()}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body, preview_url: false },
    }),
  });
  if (!res.ok) {
    throw new Error(`WhatsApp send failed (${res.status}): ${await res.text()}`);
  }
}

// Marque le message comme lu (coche bleue) : facultatif, purement cosmétique
export async function markRead(messageId: string): Promise<void> {
  try {
    await fetch(`${GRAPH}/${phoneNumberId()}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
    });
  } catch {
    // sans conséquence
  }
}

// Télécharge un média reçu (image) : 1) métadonnées -> URL signée, 2) contenu
export async function downloadMedia(mediaId: string): Promise<{ data: Buffer; mimeType: string }> {
  const meta = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!meta.ok) throw new Error(`Media lookup failed (${meta.status})`);
  const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };

  const file = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!file.ok) throw new Error(`Media download failed (${file.status})`);
  return { data: Buffer.from(await file.arrayBuffer()), mimeType: mime_type };
}

// Vérifie X-Hub-Signature-256 quand WHATSAPP_APP_SECRET est défini
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = header.slice("sha256=".length);
  if (expected.length !== got.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}

// Forme normalisée d'un message entrant, indépendante du fournisseur
export type InboundMessage = {
  id: string;
  from: string; // E.164 sans "+"
  profileName: string | null;
  type: "text" | "image" | "audio" | "document" | "other";
  text: string | null;
  mediaId: string | null;
  mimeType: string | null;
  caption: string | null;
};

// Extrait les messages d'un payload webhook Cloud API (ignore les statuts de livraison)
export function extractMessages(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value ?? {};
      const contacts = (value.contacts as Array<{ wa_id: string; profile?: { name?: string } }>) ?? [];
      const messages = (value.messages as Array<Record<string, unknown>>) ?? [];
      for (const m of messages) {
        const from = String(m.from ?? "");
        const type = String(m.type ?? "other");
        const contact = contacts.find((c) => c.wa_id === from);
        const media = (m[type] as { id?: string; mime_type?: string; caption?: string } | undefined) ?? {};
        out.push({
          id: String(m.id ?? ""),
          from,
          profileName: contact?.profile?.name ?? null,
          type: (["text", "image", "audio", "document"].includes(type) ? type : "other") as InboundMessage["type"],
          text: type === "text" ? String((m.text as { body?: string })?.body ?? "") : null,
          mediaId: media.id ?? null,
          mimeType: media.mime_type ?? null,
          caption: media.caption ?? null,
        });
      }
    }
  }
  return out;
}

import Anthropic from "@anthropic-ai/sdk";
import type { ParsedTx } from "./types";

// Modèle configurable : CLAUDE_MODEL dans .env (par défaut Sonnet 5)
const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-5";

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const SYSTEM_PROMPT = `Tu extrais des transactions financières à partir d'images : captures d'écran
de l'application Wave ou Orange Money (Sénégal), SMS de notification, ou photos de reçus / tickets de caisse.

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, sans balises markdown.
Chaque élément :
{
  "provider": "wave" | "orange_money" | "other",
  "direction": "debit" | "credit",
  "amount": entier en francs CFA (sans décimales, sans les frais),
  "fee": entier (0 si absent),
  "counterparty": nom du marchand ou de la personne, ou null,
  "kind": "transfer" | "payment" | "withdrawal" | "deposit" | "airtime" | "bill" | "other",
  "reference": identifiant de transaction si visible, sinon null,
  "balance_after": solde après opération si visible, sinon null,
  "occurred_at": date-heure ISO 8601 si visible (année courante si absente), sinon null
}

Règles :
- "debit" = argent qui sort (envoyé, payé, retiré, acheté). "credit" = argent qui entre (reçu, dépôt).
- Une capture d'historique contient souvent plusieurs transactions : retourne-les toutes, de la plus récente à la plus ancienne.
- Un reçu papier = une seule transaction, direction "debit", kind "payment", counterparty = nom du commerce, provider "other" sauf si le moyen de paiement Wave / Orange Money est visible.
- Si un montant est ambigu, choisis le total payé. Ne fabrique jamais de transaction absente de l'image.
- Si aucune transaction n'est lisible, retourne [].`;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY manquant : ajoutez-le dans .env.local (et sur Netlify).");
  }
  return new Anthropic();
}

export async function parseImageTransactions(
  base64Data: string,
  mediaType: ImageMediaType,
  hint?: string
): Promise<ParsedTx[]> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
          {
            type: "text",
            text: hint
              ? `Contexte donné par l'utilisateur : ${hint}. Extrais les transactions.`
              : "Extrais les transactions de cette image.",
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");

  return safeParseTransactions(text);
}

// Nettoie la réponse (balises ```json éventuelles) et valide chaque élément
export function safeParseTransactions(text: string): ParsedTx[] {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return [];

  let raw: unknown;
  try {
    raw = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const providers = ["wave", "orange_money", "other"];
  const kinds = ["transfer", "payment", "withdrawal", "deposit", "airtime", "bill", "other"];

  return raw
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => {
      const amount = Math.round(Number(r.amount));
      if (!Number.isFinite(amount) || amount <= 0) return null;
      const provider = providers.includes(String(r.provider)) ? String(r.provider) : "other";
      const kind = kinds.includes(String(r.kind)) ? String(r.kind) : "other";
      const direction = r.direction === "credit" ? "credit" : "debit";
      const occurred = r.occurred_at ? new Date(String(r.occurred_at)) : null;
      return {
        provider,
        direction,
        amount,
        fee: Number.isFinite(Number(r.fee)) ? Math.round(Number(r.fee)) : 0,
        counterparty: r.counterparty ? String(r.counterparty).slice(0, 80) : null,
        kind,
        reference: r.reference ? String(r.reference).slice(0, 64) : null,
        balance_after: Number.isFinite(Number(r.balance_after)) && r.balance_after !== null
          ? Math.round(Number(r.balance_after))
          : null,
        occurred_at: occurred && !Number.isNaN(occurred.getTime()) ? occurred.toISOString() : null,
      } as ParsedTx;
    })
    .filter((t): t is ParsedTx => t !== null);
}

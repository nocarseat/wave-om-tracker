import { createHash } from "crypto";
import type { Direction, ParsedTx, Provider, TxKind } from "./types";

/*
 * Parsing des SMS de notification Wave et Orange Money (Sénégal).
 *
 * Les formats exacts changent avec le temps et selon le type d'opération.
 * Ce parseur est volontairement tolérant : il cherche des mots-clés et des
 * montants plutôt qu'un format rigide. Les SMS non reconnus sont conservés
 * dans inbound_sms (status = 'ignored' ou 'error') pour affiner les regex
 * avec de vrais exemples. Voir aussi src/lib/sms.samples.ts.
 */

// Pas de \b autour des mots accentués : en JS, "é" n'est pas un caractère de mot.
const DEBIT_WORDS = /(envoy[ée]|transf[ée]r|pay[ée]|paiement|achat|achet[ée]|retir[ée]|retrait|facture|d[ée]bit)/i;
const CREDIT_WORDS = /(re[çc]u|d[ée]p[oô]t|d[ée]pos[ée]|vers[ée] sur votre)/i;

// "5 000 FCFA", "5000FCFA", "5,000F", "12.500 F CFA", "5000 CFA"
const AMOUNT_RE = /(\d{1,3}(?:[ \u202f\u00a0.,]\d{3})+|\d+)\s?(?:F\s?CFA|FCFA|CFA|F)(?![a-z])/gi;

export function detectProvider(sender: string | null | undefined, body: string): Provider {
  const s = (sender ?? "").toLowerCase();
  const b = body.toLowerCase();
  if (s.includes("wave") || /\bwave\b/.test(b)) return "wave";
  if (s.includes("orange") || s === "om" || /orange\s?money|\bom\b/.test(b)) return "orange_money";
  // Heuristique : Wave écrit "5,000F", Orange Money écrit "5000 FCFA"
  if (/\d,\d{3}F\b/.test(body)) return "wave";
  if (/FCFA/i.test(body)) return "orange_money";
  return "other";
}

function toNumber(raw: string): number {
  return Number(raw.replace(/[^\d]/g, ""));
}

function findAmountAfter(body: string, keyword: RegExp): number | null {
  const m = body.match(keyword);
  if (!m || m.index === undefined) return null;
  const tail = body.slice(m.index + m[0].length);
  const a = tail.match(new RegExp(AMOUNT_RE.source, "i"));
  return a ? toNumber(a[1]) : null;
}

function detectKind(body: string): TxKind {
  const b = body.toLowerCase();
  if (/retrait|retir[ée]|cash ?out/.test(b)) return "withdrawal";
  if (/d[ée]p[oô]t|d[ée]pos[ée]|cash ?in/.test(b)) return "deposit";
  if (/cr[ée]dit|recharge|pass |illimix|forfait/.test(b)) return "airtime";
  if (/facture|senelec|woyofal|sen'?eau|sde\b|canal/.test(b)) return "bill";
  if (/pay[ée]|paiement|marchand|achat/.test(b)) return "payment";
  if (/envoy[ée]|transf[ée]r|re[çc]u|recu/.test(b)) return "transfer";
  return "other";
}

// "reçu / dépôt" l'emporte : c'est de l'argent qui arrive sur le compte.
// Cas connu non géré : "Votre paiement a été reçu" (confirmation marchand) serait lu comme un crédit.
function detectDirection(body: string, kind: TxKind): Direction | null {
  if (kind === "deposit") return "credit";
  if (CREDIT_WORDS.test(body)) return "credit";
  if (DEBIT_WORDS.test(body)) return "debit";
  return null;
}

const CP_END = String.raw`(?=\s*[(.]|\s+(?:Frais|Nouveau|Votre|Solde|ID|Ref|R[ée]f|Le \d)|$)`;
const CP_PATTERNS: RegExp[] = [
  new RegExp(String.raw`\bchez\s+([^.\n(]+?)` + CP_END, "i"),
  new RegExp(String.raw`(?:^|\s)(?:à|a|au|aupr[èe]s de)\s+([^.\n(]+?)` + CP_END, "i"),
  new RegExp(String.raw`\bpour le\s+(\+?\d[\d ]{6,})`, "i"),
  new RegExp(String.raw`(?:re[çc]u|de la part)(?:\s+\S+)?\s+de\s+([^.\n(]+?)` + CP_END, "i"),
];

function extractCounterparty(body: string): string | null {
  for (const re of CP_PATTERNS) {
    const m = body.match(re);
    if (!m) continue;
    const name = m[1].replace(/\s+/g, " ").trim();
    if (!name || name.length > 60) continue;
    // Un numéro de téléphone est une contrepartie valide
    if (/^\+?\d[\d ]{6,}$/.test(name)) return name.replace(/\s/g, "");
    // Sinon on refuse ce qui commence par un chiffre ou contient un montant
    if (/^\d/.test(name)) continue;
    if (new RegExp(AMOUNT_RE.source, "i").test(name)) continue;
    return name;
  }
  return null;
}

function extractReference(body: string): string | null {
  const m = body.match(
    /(?:ID(?: de)? transaction|Transaction ID|R[ée]f(?:[ée]rence)?|Trans(?:action)?\.?\s?ID|N[°o] transaction)\s*[:.]?\s*([A-Z0-9][A-Z0-9.\-_]{4,})/i
  );
  return m ? m[1] : null;
}

export function parseSms(sender: string | null | undefined, body: string): ParsedTx | null {
  const text = body.replace(/\s+/g, " ").trim();
  const provider = detectProvider(sender, text);

  const amounts = Array.from(text.matchAll(AMOUNT_RE)).map((m) => toNumber(m[1]));
  if (amounts.length === 0) return null;

  const kind = detectKind(text);
  const direction = detectDirection(text, kind);
  if (!direction) return null;

  const fee = findAmountAfter(text, /frais\s*(?:de|:)?/i) ?? 0;
  const balance_after = findAmountAfter(text, /solde\s*(?:est|:|de|actuel)?\s*(?:de)?\s*:?/i);

  // Montant principal : le premier montant qui n'est ni les frais ni le solde
  const amount =
    amounts.find((a) => a !== fee && a !== balance_after) ?? amounts[0];

  return {
    provider,
    direction,
    amount,
    fee,
    counterparty: extractCounterparty(text),
    kind,
    reference: extractReference(text),
    balance_after,
    occurred_at: null,
  };
}

// Empreinte pour la déduplication : référence opérateur si présente,
// sinon hash du contenu + minute de réception.
export function fingerprintFor(
  parsed: ParsedTx,
  rawText: string,
  receivedAt: Date
): string {
  if (parsed.reference) return `${parsed.provider}:${parsed.reference}`;
  const minute = new Date(receivedAt);
  minute.setSeconds(0, 0);
  return createHash("sha256")
    .update(`${parsed.provider}|${rawText.trim()}|${minute.toISOString()}`)
    .digest("hex")
    .slice(0, 32);
}

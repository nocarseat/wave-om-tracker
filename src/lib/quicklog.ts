import type { ParsedTx, Provider } from "./types";

/*
 * Saisie rapide par message : "5000 taxi", "2 500 pain wave", "taxi 1500 om",
 * "reçu 10000 de moussa", "+20000 salaire". Retourne null si aucun montant.
 */
const AMOUNT = /(?:^|\s)([+-]?)(\d{1,3}(?:[ \u202f\u00a0.]\d{3})+|\d+)\s?(?:f|fcfa|cfa|francs?)?(?=\s|$)/i;
const PROVIDER_WORDS: Array<[RegExp, Provider]> = [
  [/\b(wave)\b/i, "wave"],
  [/\b(om|orange|orange money)\b/i, "orange_money"],
  [/\b(cash|esp[èe]ces|liquide)\b/i, "other"],
];
const CREDIT_WORDS = /\b(re[çc]u|recu|entr[ée]e|salaire|gagn[ée]|d[ée]p[oô]t)\b/i;

export function parseQuickLog(text: string): ParsedTx | null {
  const t = text.trim();
  const m = t.match(AMOUNT);
  if (!m) return null;
  const amount = Number(m[2].replace(/[^\d]/g, ""));
  if (!amount) return null;

  let provider: Provider = "wave";
  let rest = t.replace(m[0], " ");
  for (const [re, p] of PROVIDER_WORDS) {
    if (re.test(rest)) {
      provider = p;
      rest = rest.replace(re, " ");
    }
  }
  const isCredit = m[1] === "+" || CREDIT_WORDS.test(rest);
  const label = rest
    .replace(CREDIT_WORDS, " ")
    .replace(/\b(pour|de|à|a|au|chez|le|la|les|du|des|un|une)\b/gi, " ")
    .replace(/[.,;:!]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    provider,
    direction: isCredit ? "credit" : "debit",
    amount,
    fee: 0,
    counterparty: label ? label.charAt(0).toUpperCase() + label.slice(1) : null,
    kind: isCredit ? "deposit" : "payment",
    reference: null,
    balance_after: null,
    occurred_at: null,
  };
}

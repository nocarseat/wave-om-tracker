import type { Category, TxKind } from "./types";

// Règles mot-clé -> nom de catégorie (appliquées sur contrepartie + texte brut, en minuscules).
// Les règles apprises (table merchant_rules) passent avant celles-ci.
const KEYWORD_RULES: Array<[RegExp, string]> = [
  [/senelec|woyofal|sen'?eau|sde\b|eau\b|electricit|électricit/, "Factures"],
  [/canal\+|canal plus|netflix|spotify|dstv|startimes/, "Loisirs"],
  [/free\b|orange\b.*cr[ée]dit|cr[ée]dit|recharge|pass internet|illimix|forfait/, "Crédit téléphonique"],
  [/yango|heetch|uber|taxi|bus|ddd\b|carburant|essence|total|shell|péage|peage/, "Transport"],
  [/auchan|carrefour|casino|boulangerie|marché|marche|supermarch|epicerie|épicerie|restaurant|dibiterie|fast food/, "Alimentation"],
  [/pharmacie|clinique|hopital|hôpital|médecin|medecin|labo/, "Santé"],
  [/école|ecole|universit|scolarit|formation|cours/, "Éducation"],
  [/loyer|bailleur|immobili/, "Logement"],
  [/retrait|agent|cash out|withdraw/, "Retrait cash"],
  [/frais/, "Frais opérateur"],
];

// Catégorie déduite du type de transaction quand aucun mot-clé ne matche
const KIND_DEFAULTS: Partial<Record<TxKind, string>> = {
  withdrawal: "Retrait cash",
  airtime: "Crédit téléphonique",
  bill: "Factures",
  transfer: "Famille et transferts",
  deposit: "Dépôt",
};

export function guessCategoryName(
  text: string,
  kind: TxKind,
  direction: "debit" | "credit"
): string {
  if (direction === "credit") return kind === "deposit" ? "Dépôt" : "Revenus";
  const t = text.toLowerCase();
  for (const [re, name] of KEYWORD_RULES) {
    if (re.test(t)) return name;
  }
  return KIND_DEFAULTS[kind] ?? "Autre";
}

export function findCategoryId(categories: Category[], name: string): string | null {
  const exact = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  return exact?.id ?? categories.find((c) => c.name === "Autre")?.id ?? null;
}

// Normalise une contrepartie pour les règles apprises (merchant_rules.pattern)
export function normalizeMerchant(counterparty: string | null): string | null {
  if (!counterparty) return null;
  const n = counterparty.toLowerCase().replace(/\s+/g, " ").trim();
  return n.length >= 3 ? n : null;
}

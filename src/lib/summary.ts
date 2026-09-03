import type { SupabaseClient } from "@supabase/supabase-js";
import { fcfa, monthLabel, monthStart } from "./format";

export type MonthSummary = {
  month: string;
  label: string;
  spent: number;
  fees: number;
  income: number;
  byProvider: { wave: number; orange_money: number; other: number };
  byCategory: Array<{ name: string; spent: number; budget: number }>;
  budgetTotal: number;
  topCounterparties: Array<{ name: string; total: number; count: number }>;
  count: number;
};

// Résumé du mois courant : utilisé par les réponses WhatsApp et comme contexte pour Claude
export async function monthSummary(supabase: SupabaseClient, userId: string): Promise<MonthSummary> {
  const month = monthStart();
  const [tx, cats, budgets] = await Promise.all([
    supabase
      .from("transactions")
      .select("provider, direction, amount, fee, counterparty, category_id")
      .eq("user_id", userId)
      .gte("occurred_at", month),
    supabase.from("categories").select("id, name, kind").eq("user_id", userId),
    supabase.from("budgets").select("category_id, amount").eq("user_id", userId).eq("month", month),
  ]);

  const rows = tx.data ?? [];
  const debits = rows.filter((r) => r.direction === "debit");
  const out = (r: { amount: number; fee: number }) => Number(r.amount) + Number(r.fee);

  const byProvider = { wave: 0, orange_money: 0, other: 0 };
  const catSpent = new Map<string | null, number>();
  const cp = new Map<string, { total: number; count: number }>();
  let fees = 0;
  for (const r of debits) {
    byProvider[r.provider as keyof typeof byProvider] += out(r);
    fees += Number(r.fee);
    catSpent.set(r.category_id, (catSpent.get(r.category_id) ?? 0) + out(r));
    if (r.counterparty) {
      const k = r.counterparty;
      const cur = cp.get(k) ?? { total: 0, count: 0 };
      cp.set(k, { total: cur.total + out(r), count: cur.count + 1 });
    }
  }

  const byCategory = (cats.data ?? [])
    .filter((c) => c.kind === "expense")
    .map((c) => ({
      name: c.name,
      spent: catSpent.get(c.id) ?? 0,
      budget: Number(budgets.data?.find((b) => b.category_id === c.id)?.amount ?? 0),
    }))
    .filter((c) => c.spent > 0 || c.budget > 0)
    .sort((a, b) => b.spent - a.spent);

  return {
    month,
    label: monthLabel(month),
    spent: debits.reduce((s, r) => s + out(r), 0),
    fees,
    income: rows.filter((r) => r.direction === "credit").reduce((s, r) => s + Number(r.amount), 0),
    byProvider,
    byCategory,
    budgetTotal: (budgets.data ?? []).reduce((s, b) => s + Number(b.amount), 0),
    topCounterparties: Array.from(cp.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
    count: rows.length,
  };
}

// Deux lignes de bilan ajoutées après chaque enregistrement
export function summaryFooter(s: MonthSummary): string {
  const lines = [`Ce mois : ${fcfa(s.spent)} dépensés`];
  if (s.budgetTotal > 0) {
    const left = s.budgetTotal - s.spent;
    lines[0] += left >= 0 ? `, reste ${fcfa(left)} sur ton budget.` : `, budget dépassé de ${fcfa(-left)}.`;
  } else {
    lines[0] += ".";
  }
  if (s.fees > 0) lines.push(`Frais payés ce mois : ${fcfa(s.fees)}.`);
  return lines.join("\n");
}

// Texte compact du mois, donné à Claude pour répondre aux questions
export function summaryForModel(s: MonthSummary): string {
  const cats = s.byCategory
    .map((c) => `${c.name}: ${c.spent} F${c.budget ? ` (budget ${c.budget} F)` : ""}`)
    .join("; ");
  const top = s.topCounterparties.map((c) => `${c.name}: ${c.total} F (${c.count}x)`).join("; ");
  return [
    `Mois: ${s.label}. Opérations: ${s.count}.`,
    `Dépenses: ${s.spent} F (Wave ${s.byProvider.wave} F, Orange Money ${s.byProvider.orange_money} F, autre ${s.byProvider.other} F). Frais: ${s.fees} F. Entrées: ${s.income} F. Budget total: ${s.budgetTotal} F.`,
    `Par catégorie: ${cats || "aucune"}.`,
    `Principaux destinataires/marchands: ${top || "aucun"}.`,
  ].join("\n");
}

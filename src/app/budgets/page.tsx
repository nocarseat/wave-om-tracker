import { Shell } from "@/components/Shell";
import { createClient, getUser } from "@/lib/supabase/server";
import { fcfa, monthLabel, monthStart } from "@/lib/format";
import type { Budget, Category } from "@/lib/types";
import { saveBudgets } from "./actions";

export default async function BudgetsPage() {
  const user = await getUser();
  const supabase = await createClient();
  const month = monthStart();
  const prevMonths = 3;
  const since = new Date();
  since.setMonth(since.getMonth() - prevMonths, 1);
  since.setHours(0, 0, 0, 0);

  const [catRes, budgetRes, txRes] = await Promise.all([
    supabase.from("categories").select("*").eq("user_id", user!.id).eq("kind", "expense").order("sort_order"),
    supabase.from("budgets").select("*").eq("user_id", user!.id).eq("month", month),
    supabase
      .from("transactions")
      .select("category_id, amount, fee, occurred_at")
      .eq("user_id", user!.id)
      .eq("direction", "debit")
      .gte("occurred_at", since.toISOString())
      .lt("occurred_at", month),
  ]);
  const categories = (catRes.data ?? []) as Category[];
  const budgets = (budgetRes.data ?? []) as Budget[];

  // Moyenne mensuelle des 3 derniers mois : base de la recommandation
  const avg = new Map<string, number>();
  for (const t of txRes.data ?? []) {
    const k = t.category_id ?? "none";
    avg.set(k, (avg.get(k) ?? 0) + Number(t.amount) + Number(t.fee));
  }
  const monthsWithData = Math.max(1, new Set((txRes.data ?? []).map((t) => String(t.occurred_at).slice(0, 7))).size);

  return (
    <Shell title="Budgets">
      <p className="mb-3 px-1 text-sm text-ink-muted">
        Montants pour {monthLabel(month)}. La suggestion est la moyenne des {prevMonths} derniers mois quand il y a de l&apos;historique.
      </p>
      <form action={saveBudgets} className="card divide-y divide-line">
        {categories.map((c) => {
          const current = budgets.find((b) => b.category_id === c.id)?.amount;
          const suggestion = avg.has(c.id) ? Math.round((avg.get(c.id) ?? 0) / monthsWithData / 500) * 500 : null;
          return (
            <label key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1 text-sm">
                {c.name}
                {suggestion ? (
                  <span className="block text-xs text-ink-muted">Suggestion {fcfa(suggestion)}</span>
                ) : null}
              </span>
              <input
                className="field w-32 text-right"
                name={`budget:${c.id}`}
                inputMode="numeric"
                placeholder={suggestion ? String(suggestion) : "0"}
                defaultValue={current ? Number(current) : ""}
              />
            </label>
          );
        })}
        <div className="p-4">
          <button className="btn w-full" type="submit">
            Enregistrer les budgets
          </button>
        </div>
      </form>
    </Shell>
  );
}

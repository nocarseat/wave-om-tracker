import Link from "next/link";
import { Shell } from "@/components/Shell";
import { ProviderMark } from "@/components/ProviderMark";
import { createClient, getUser } from "@/lib/supabase/server";
import { fcfa, monthLabel, monthStart, pct, shortDate } from "@/lib/format";
import type { Budget, Category, Transaction } from "@/lib/types";

const outflow = (t: Transaction) => Number(t.amount) + Number(t.fee);

export default async function DashboardPage() {
  const user = await getUser();
  const supabase = await createClient();
  const month = monthStart();

  const [txRes, catRes, budgetRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user!.id)
      .gte("occurred_at", month)
      .order("occurred_at", { ascending: false }),
    supabase.from("categories").select("*").eq("user_id", user!.id).order("sort_order"),
    supabase.from("budgets").select("*").eq("user_id", user!.id).eq("month", month),
  ]);

  const txs = (txRes.data ?? []) as Transaction[];
  const categories = (catRes.data ?? []) as Category[];
  const budgets = (budgetRes.data ?? []) as Budget[];
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name;

  const debits = txs.filter((t) => t.direction === "debit");
  const total = debits.reduce((s, t) => s + outflow(t), 0);
  const income = txs.filter((t) => t.direction === "credit").reduce((s, t) => s + Number(t.amount), 0);
  const byProvider = {
    wave: debits.filter((t) => t.provider === "wave").reduce((s, t) => s + outflow(t), 0),
    orange_money: debits.filter((t) => t.provider === "orange_money").reduce((s, t) => s + outflow(t), 0),
    other: debits.filter((t) => t.provider === "other").reduce((s, t) => s + outflow(t), 0),
  };

  const spentByCategory = new Map<string, number>();
  for (const t of debits) {
    const key = t.category_id ?? "none";
    spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + outflow(t));
  }
  const rows = categories
    .filter((c) => c.kind === "expense")
    .map((c) => ({
      cat: c,
      spent: spentByCategory.get(c.id) ?? 0,
      budget: Number(budgets.find((b) => b.category_id === c.id)?.amount ?? 0),
    }))
    .filter((r) => r.spent > 0 || r.budget > 0)
    .sort((a, b) => b.spent - a.spent);
  const uncategorized = spentByCategory.get("none") ?? 0;
  const budgetTotal = budgets.reduce((s, b) => s + Number(b.amount), 0);

  return (
    <Shell title={monthLabel(month)}>
      {/* Total du mois : le chiffre qui compte, en grand */}
      <section className="card p-5">
        <p className="text-sm text-ink-muted">Dépensé ce mois</p>
        <p className="mt-1 text-[40px] leading-none font-medium tracking-tight">{fcfa(total)}</p>
        {budgetTotal > 0 && (
          <p className="mt-2 text-sm text-ink-muted">
            Budget total {fcfa(budgetTotal)}, reste{" "}
            <span className={budgetTotal - total < 0 ? "text-over" : "text-ok"}>
              {fcfa(budgetTotal - total)}
            </span>
          </p>
        )}
        {income > 0 && <p className="mt-1 text-sm text-ink-muted">Reçu {fcfa(income)}</p>}

        {/* Répartition Wave / Orange Money : une seule bande bicolore */}
        {total > 0 && (
          <div className="mt-5">
            <div className="flex h-3 overflow-hidden rounded-full bg-surface">
              <div className="bg-wave" style={{ width: `${(byProvider.wave / total) * 100}%` }} />
              <div className="bg-om" style={{ width: `${(byProvider.orange_money / total) * 100}%` }} />
              <div className="bg-ink-muted" style={{ width: `${(byProvider.other / total) * 100}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span className="flex items-center gap-2">
                <ProviderMark provider="wave" /> Wave {fcfa(byProvider.wave)}
              </span>
              <span className="flex items-center gap-2">
                <ProviderMark provider="orange_money" /> Orange Money {fcfa(byProvider.orange_money)}
              </span>
              {byProvider.other > 0 && (
                <span className="flex items-center gap-2">
                  <ProviderMark provider="other" /> Autre {fcfa(byProvider.other)}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Catégories et budgets */}
      <section className="mt-4">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-base font-medium">Par catégorie</h2>
          <Link href="/budgets" className="text-sm text-ink-muted underline-offset-4 hover:underline">
            Définir les budgets
          </Link>
        </div>
        {rows.length === 0 ? (
          <Empty text="Aucune dépense ce mois. Ajoutez une opération ou importez une capture d'écran." />
        ) : (
          <ul className="card divide-y divide-line">
            {rows.map(({ cat, spent, budget }) => {
              const over = budget > 0 && spent > budget;
              return (
                <li key={cat.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{cat.name}</span>
                    <span className={over ? "text-over" : ""}>
                      {fcfa(spent)}
                      {budget > 0 && <span className="text-ink-muted"> / {fcfa(budget)}</span>}
                    </span>
                  </div>
                  {budget > 0 && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                      <div
                        className={`h-full rounded-full ${over ? "bg-over" : "bg-ink"}`}
                        style={{ width: `${pct(spent, budget)}%` }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
            {uncategorized > 0 && (
              <li className="flex justify-between px-4 py-3 text-sm text-ink-muted">
                <span>Sans catégorie</span>
                <span>{fcfa(uncategorized)}</span>
              </li>
            )}
          </ul>
        )}
      </section>

      {/* Dernières opérations */}
      <section className="mt-4">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-base font-medium">Dernières opérations</h2>
          <Link href="/transactions" className="text-sm text-ink-muted underline-offset-4 hover:underline">
            Tout voir
          </Link>
        </div>
        {txs.length === 0 ? (
          <Empty text="Rien pour l'instant." />
        ) : (
          <ul className="card divide-y divide-line">
            {txs.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <ProviderMark provider={t.provider} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{t.counterparty ?? catName(t.category_id) ?? "Opération"}</p>
                  <p className="text-xs text-ink-muted">
                    {shortDate(t.occurred_at)}
                    {catName(t.category_id) ? `, ${catName(t.category_id)}` : ""}
                  </p>
                </div>
                <p className={`text-sm ${t.direction === "credit" ? "text-ok" : ""}`}>
                  {t.direction === "credit" ? "+" : "-"}
                  {fcfa(Number(t.amount))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="card px-4 py-6 text-center text-sm text-ink-muted">{text}</p>;
}

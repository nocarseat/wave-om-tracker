import { Shell } from "@/components/Shell";
import { ProviderMark } from "@/components/ProviderMark";
import { CategorySelect } from "@/components/CategorySelect";
import { SmsPasteForm } from "@/components/SmsPasteForm";
import { createClient, getUser } from "@/lib/supabase/server";
import { dateTimeLocal, fcfa } from "@/lib/format";
import type { Category, Transaction } from "@/lib/types";
import { addManualTransaction, deleteTransaction } from "./actions";

export default async function TransactionsPage() {
  const user = await getUser();
  const supabase = await createClient();
  const [txRes, catRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user!.id)
      .order("occurred_at", { ascending: false })
      .limit(150),
    supabase.from("categories").select("*").eq("user_id", user!.id).order("sort_order"),
  ]);
  const txs = (txRes.data ?? []) as Transaction[];
  const categories = (catRes.data ?? []) as Category[];
  const expenseCats = categories.filter((c) => c.kind === "expense");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Shell title="Opérations">
      <div className="space-y-4">
        <SmsPasteForm />

        {/* Saisie manuelle */}
        <details className="card p-4">
          <summary className="cursor-pointer text-base font-medium">Saisir une opération</summary>
          <form action={addManualTransaction} className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm text-ink-muted">Montant (F)</span>
                <input className="field" name="amount" inputMode="numeric" required placeholder="5000" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-ink-muted">Date</span>
                <input className="field" name="occurred_at" type="date" defaultValue={today} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm text-ink-muted">Compte</span>
                <select className="field" name="provider" defaultValue="wave">
                  <option value="wave">Wave</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="other">Autre / espèces</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-ink-muted">Sens</span>
                <select className="field" name="direction" defaultValue="debit">
                  <option value="debit">Dépense</option>
                  <option value="credit">Entrée</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm text-ink-muted">Marchand ou personne</span>
              <input className="field" name="counterparty" placeholder="Boulangerie, Awa, Senelec" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-ink-muted">Catégorie</span>
              <select className="field" name="category_id" defaultValue="">
                <option value="">Choisir plus tard</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn w-full" type="submit">
              Enregistrer
            </button>
          </form>
        </details>

        {/* Liste */}
        {txs.length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-ink-muted">Aucune opération enregistrée.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {txs.map((t) => (
              <li key={t.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <ProviderMark provider={t.provider} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{t.counterparty ?? t.note ?? "Opération"}</p>
                    <p className="text-xs text-ink-muted">
                      {dateTimeLocal(t.occurred_at)}
                      {t.fee > 0 ? `, frais ${fcfa(t.fee)}` : ""}
                      {t.source !== "manual" ? `, ${sourceLabel(t.source)}` : ""}
                    </p>
                  </div>
                  <p className={`text-sm ${t.direction === "credit" ? "text-ok" : ""}`}>
                    {t.direction === "credit" ? "+" : "-"}
                    {fcfa(Number(t.amount))}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between pl-[22px]">
                  <CategorySelect
                    txId={t.id}
                    value={t.category_id}
                    categories={t.direction === "credit" ? categories : expenseCats}
                  />
                  <form action={deleteTransaction.bind(null, t.id)}>
                    <button className="text-xs text-ink-muted underline-offset-4 hover:underline" type="submit">
                      Supprimer
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}

function sourceLabel(source: Transaction["source"]) {
  return { manual: "saisie", sms: "SMS", screenshot: "capture", receipt: "reçu" }[source];
}

"use client";

import { useTransition } from "react";
import { setTransactionCategory } from "@/app/transactions/actions";
import type { Category } from "@/lib/types";

// Sélecteur de catégorie inline : le changement est appliqué immédiatement
// et mémorisé pour ce marchand (règle apprise).
export function CategorySelect({
  txId,
  value,
  categories,
}: {
  txId: string;
  value: string | null;
  categories: Category[];
}) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Catégorie"
      className="max-w-[46vw] rounded-md border border-line bg-paper px-2 py-1 text-xs text-ink-muted"
      value={value ?? ""}
      disabled={pending}
      onChange={(e) => {
        const id = e.target.value || null;
        start(() => setTransactionCategory(txId, id, true));
      }}
    >
      <option value="">Sans catégorie</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

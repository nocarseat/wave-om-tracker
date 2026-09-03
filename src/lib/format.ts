// Montants en francs CFA (XOF), sans décimales, séparateur d'espace : 12 500 F
export function fcfa(amount: number | null | undefined): string {
  const n = Math.round(Number(amount ?? 0));
  return `${n.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ")} F`;
}

export function monthStart(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export function monthLabel(isoMonth: string): string {
  const [y, m] = isoMonth.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function dateTimeLocal(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Pourcentage borné pour les barres de budget
export function pct(spent: number, budget: number): number {
  if (!budget) return 0;
  return Math.min(100, Math.round((spent / budget) * 100));
}

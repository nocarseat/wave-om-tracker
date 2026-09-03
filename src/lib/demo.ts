import type { Direction, Provider, TxKind } from "./types";

/*
 * Données de démonstration : 3 mois de dépenses plausibles d'un salarié dakarois,
 * réparties entre Wave et Orange Money. Générées de façon déterministe (même résultat
 * à chaque chargement) et marquées par DEMO_NOTE pour pouvoir les supprimer d'un coup.
 */
export const DEMO_NOTE = "Données de démo";

type Pattern = {
  name: string;
  category: string;
  provider: Provider;
  kind: TxKind;
  direction?: Direction;
  min: number;
  max: number;
  perMonth: number; // fréquence moyenne
  day?: number; // jour fixe du mois (loyer, salaire)
  feeRate?: number;
};

const PATTERNS: Pattern[] = [
  { name: "Auchan Dakar", category: "Alimentation", provider: "wave", kind: "payment", min: 4000, max: 28000, perMonth: 6 },
  { name: "Boulangerie Jaune", category: "Alimentation", provider: "wave", kind: "payment", min: 500, max: 2500, perMonth: 14 },
  { name: "Marché Castors", category: "Alimentation", provider: "orange_money", kind: "payment", min: 2000, max: 9000, perMonth: 7 },
  { name: "Dibiterie Chez Khadim", category: "Alimentation", provider: "wave", kind: "payment", min: 2500, max: 7000, perMonth: 4 },
  { name: "Yango", category: "Transport", provider: "wave", kind: "payment", min: 1000, max: 4500, perMonth: 12 },
  { name: "Carburant Total Mermoz", category: "Transport", provider: "orange_money", kind: "payment", min: 10000, max: 20000, perMonth: 3 },
  { name: "Senelec Woyofal", category: "Factures", provider: "orange_money", kind: "bill", min: 5000, max: 15000, perMonth: 2 },
  { name: "Sen'Eau", category: "Factures", provider: "orange_money", kind: "bill", min: 7000, max: 12000, perMonth: 1, day: 12 },
  { name: "Crédit Orange", category: "Crédit téléphonique", provider: "orange_money", kind: "airtime", min: 1000, max: 5000, perMonth: 6 },
  { name: "Pass internet Free", category: "Crédit téléphonique", provider: "wave", kind: "airtime", min: 2000, max: 5000, perMonth: 3 },
  { name: "Pharmacie du Point E", category: "Santé", provider: "wave", kind: "payment", min: 2500, max: 16000, perMonth: 1.5 },
  { name: "Loyer Bailleur Ndiaye", category: "Logement", provider: "wave", kind: "transfer", min: 150000, max: 150000, perMonth: 1, day: 3, feeRate: 0.01 },
  { name: "Maman", category: "Famille et transferts", provider: "wave", kind: "transfer", min: 20000, max: 50000, perMonth: 2, feeRate: 0.01 },
  { name: "Ibou (frère)", category: "Famille et transferts", provider: "orange_money", kind: "transfer", min: 5000, max: 15000, perMonth: 1.5, feeRate: 0.01 },
  { name: "Agent Wave Pikine", category: "Retrait cash", provider: "wave", kind: "withdrawal", min: 10000, max: 30000, perMonth: 3 },
  { name: "Canal+", category: "Loisirs", provider: "wave", kind: "bill", min: 15000, max: 15000, perMonth: 1, day: 20 },
  { name: "Cinéma Sea Plaza", category: "Loisirs", provider: "wave", kind: "payment", min: 4000, max: 9000, perMonth: 1 },
  { name: "Boutique Sandaga", category: "Vêtements", provider: "orange_money", kind: "payment", min: 8000, max: 35000, perMonth: 0.7 },
  // Entrées
  { name: "Salaire", category: "Revenus", provider: "orange_money", kind: "deposit", direction: "credit", min: 350000, max: 350000, perMonth: 1, day: 28 },
  { name: "Moussa Diop", category: "Revenus", provider: "wave", kind: "transfer", direction: "credit", min: 5000, max: 25000, perMonth: 1 },
];

export const DEMO_BUDGETS: Record<string, number> = {
  Alimentation: 120000,
  Transport: 45000,
  Factures: 30000,
  "Crédit téléphonique": 20000,
  Logement: 150000,
  "Famille et transferts": 70000,
  Santé: 15000,
  Loisirs: 25000,
  "Retrait cash": 60000,
  Vêtements: 20000,
};

// Générateur pseudo-aléatoire déterministe (mulberry32)
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundTo(n: number, step: number) {
  return Math.max(step, Math.round(n / step) * step);
}

export type DemoTx = {
  provider: Provider;
  direction: Direction;
  amount: number;
  fee: number;
  counterparty: string;
  category: string;
  kind: TxKind;
  occurred_at: string;
};

export function generateDemoTransactions(now = new Date(), months = 3): DemoTx[] {
  const rand = rng(20260903);
  const out: DemoTx[] = [];

  for (let m = months - 1; m >= 0; m--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    // Le mois courant n'est rempli que jusqu'à aujourd'hui
    const lastDay = m === 0 ? now.getDate() : daysInMonth;

    for (const p of PATTERNS) {
      const count = p.day
        ? p.day <= lastDay ? 1 : 0
        : Math.round(p.perMonth * (lastDay / daysInMonth) + (rand() - 0.5));
      for (let i = 0; i < count; i++) {
        const day = p.day ?? 1 + Math.floor(rand() * lastDay);
        const hour = 7 + Math.floor(rand() * 14);
        const minute = Math.floor(rand() * 60);
        const step = p.max - p.min >= 5000 ? 500 : 100;
        const amount = roundTo(p.min + rand() * (p.max - p.min), step);
        out.push({
          provider: p.provider,
          direction: p.direction ?? "debit",
          amount,
          fee: p.feeRate ? roundTo(amount * p.feeRate, 5) : 0,
          counterparty: p.name,
          category: p.category,
          kind: p.kind,
          occurred_at: new Date(monthStart.getFullYear(), monthStart.getMonth(), day, hour, minute).toISOString(),
        });
      }
    }
  }
  return out.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
}

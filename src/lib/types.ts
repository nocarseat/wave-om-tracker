export type Provider = "wave" | "orange_money" | "other";
export type Direction = "debit" | "credit";
export type TxKind =
  | "transfer"
  | "payment"
  | "withdrawal"
  | "deposit"
  | "airtime"
  | "bill"
  | "other";
export type TxSource = "manual" | "sms" | "screenshot" | "receipt";

export type Category = {
  id: string;
  name: string;
  kind: "expense" | "income";
  sort_order: number;
};

export type Account = {
  id: string;
  provider: Exclude<Provider, "other">;
  label: string;
  phone: string | null;
};

export type Transaction = {
  id: string;
  account_id: string | null;
  provider: Provider;
  direction: Direction;
  amount: number;
  fee: number;
  counterparty: string | null;
  category_id: string | null;
  kind: TxKind;
  occurred_at: string;
  source: TxSource;
  reference: string | null;
  balance_after: number | null;
  raw_text: string | null;
  note: string | null;
};

export type Budget = {
  id: string;
  category_id: string;
  month: string;
  amount: number;
};

// Résultat d'un parsing (SMS ou image) avant insertion
export type ParsedTx = {
  provider: Provider;
  direction: Direction;
  amount: number;
  fee: number;
  counterparty: string | null;
  kind: TxKind;
  reference: string | null;
  balance_after: number | null;
  occurred_at: string | null;
};

export const PROVIDER_LABEL: Record<Provider, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  other: "Autre",
};

export const KIND_LABEL: Record<TxKind, string> = {
  transfer: "Transfert",
  payment: "Paiement",
  withdrawal: "Retrait",
  deposit: "Dépôt",
  airtime: "Crédit",
  bill: "Facture",
  other: "Autre",
};

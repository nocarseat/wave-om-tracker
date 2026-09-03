import type { SupabaseClient } from "@supabase/supabase-js";
import { findCategoryId, guessCategoryName, normalizeMerchant } from "./categories";
import { fingerprintFor } from "./sms";
import type { Account, Category, ParsedTx, TxSource } from "./types";

export type RecordResult =
  | { status: "inserted"; id: string }
  | { status: "duplicate" }
  | { status: "error"; message: string };

type Context = {
  accounts: Account[];
  categories: Category[];
  rules: Array<{ pattern: string; category_id: string }>;
};

// Charge en une fois ce qu'il faut pour catégoriser et rattacher un compte
export async function loadContext(supabase: SupabaseClient, userId: string): Promise<Context> {
  const [accounts, categories, rules] = await Promise.all([
    supabase.from("accounts").select("id, provider, label, phone").eq("user_id", userId),
    supabase.from("categories").select("id, name, kind, sort_order").eq("user_id", userId),
    supabase.from("merchant_rules").select("pattern, category_id").eq("user_id", userId),
  ]);
  return {
    accounts: (accounts.data ?? []) as Account[],
    categories: (categories.data ?? []) as Category[],
    rules: rules.data ?? [],
  };
}

export function pickCategory(ctx: Context, parsed: ParsedTx, rawText: string): string | null {
  const merchant = normalizeMerchant(parsed.counterparty);
  if (merchant) {
    const rule = ctx.rules.find((r) => merchant.includes(r.pattern) || r.pattern.includes(merchant));
    if (rule) return rule.category_id;
  }
  const name = guessCategoryName(`${parsed.counterparty ?? ""} ${rawText}`, parsed.kind, parsed.direction);
  return findCategoryId(ctx.categories, name);
}

// Insère une transaction parsée (SMS, capture, reçu ou saisie). Gère la déduplication.
export async function recordParsedTx(
  supabase: SupabaseClient,
  userId: string,
  parsed: ParsedTx,
  opts: { source: TxSource; rawText: string | null; receivedAt?: Date; ctx?: Context }
): Promise<RecordResult> {
  const ctx = opts.ctx ?? (await loadContext(supabase, userId));
  const receivedAt = opts.receivedAt ?? new Date();
  const account = ctx.accounts.find((a) => a.provider === parsed.provider) ?? null;
  const fingerprint =
    opts.source === "manual" ? null : fingerprintFor(parsed, opts.rawText ?? "", receivedAt);

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: account?.id ?? null,
      provider: parsed.provider,
      direction: parsed.direction,
      amount: parsed.amount,
      fee: parsed.fee,
      counterparty: parsed.counterparty,
      category_id: pickCategory(ctx, parsed, opts.rawText ?? ""),
      kind: parsed.kind,
      occurred_at: parsed.occurred_at ?? receivedAt.toISOString(),
      source: opts.source,
      reference: parsed.reference,
      balance_after: parsed.balance_after,
      raw_text: opts.rawText,
      fingerprint,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { status: "duplicate" };
    return { status: "error", message: error.message };
  }
  return { status: "inserted", id: data.id };
}

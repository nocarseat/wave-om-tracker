"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { normalizeMerchant } from "@/lib/categories";
import { recordParsedTx } from "@/lib/ingest";
import { parseSms } from "@/lib/sms";
import type { ParsedTx, Provider, TxKind } from "@/lib/types";

async function requireUser() {
  const user = await getUser();
  if (!user) throw new Error("Non connecté");
  return user;
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
}

// Saisie manuelle
export async function addManualTransaction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const amount = Math.round(Number(String(formData.get("amount")).replace(/[^\d]/g, "")));
  if (!amount) return;

  const provider = (formData.get("provider") as Provider) ?? "wave";
  const direction = formData.get("direction") === "credit" ? "credit" : "debit";
  const categoryId = String(formData.get("category_id") || "") || null;
  const counterparty = String(formData.get("counterparty") || "").trim() || null;
  const date = String(formData.get("occurred_at") || "");

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", provider)
    .maybeSingle();

  await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: account?.id ?? null,
    provider,
    direction,
    amount,
    counterparty,
    category_id: categoryId,
    kind: "other",
    occurred_at: date ? new Date(date).toISOString() : new Date().toISOString(),
    source: "manual",
    note: String(formData.get("note") || "").trim() || null,
  });
  revalidateAll();
}

// Collage d'un SMS Wave / Orange Money
export async function addFromSmsText(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const supabase = await createClient();
  const body = String(formData.get("sms") || "").trim();
  if (!body) return { ok: false, message: "Collez le texte du SMS." };

  const parsed = parseSms(String(formData.get("sender") || ""), body);
  if (!parsed) return { ok: false, message: "SMS non reconnu. Saisissez l'opération manuellement." };

  const result = await recordParsedTx(supabase, user.id, parsed, { source: "sms", rawText: body });
  revalidateAll();
  if (result.status === "inserted") return { ok: true, message: "Opération ajoutée." };
  if (result.status === "duplicate") return { ok: false, message: "Ce SMS a déjà été enregistré." };
  return { ok: false, message: result.message };
}

// Enregistre les transactions confirmées depuis la page Importer
export async function saveImported(itemsJson: string, source: "screenshot" | "receipt"): Promise<{ inserted: number; duplicates: number }> {
  const user = await requireUser();
  const supabase = await createClient();
  const items = JSON.parse(itemsJson) as ParsedTx[];
  let inserted = 0;
  let duplicates = 0;
  for (const item of items) {
    const r = await recordParsedTx(supabase, user.id, item, {
      source,
      rawText: JSON.stringify(item),
    });
    if (r.status === "inserted") inserted++;
    if (r.status === "duplicate") duplicates++;
  }
  revalidateAll();
  return { inserted, duplicates };
}

// Changement de catégorie, avec apprentissage de la règle marchand
export async function setTransactionCategory(txId: string, categoryId: string | null, learn: boolean): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: tx } = await supabase
    .from("transactions")
    .update({ category_id: categoryId })
    .eq("id", txId)
    .eq("user_id", user.id)
    .select("counterparty")
    .single();

  const pattern = normalizeMerchant(tx?.counterparty ?? null);
  if (learn && categoryId && pattern) {
    await supabase
      .from("merchant_rules")
      .upsert({ user_id: user.id, pattern, category_id: categoryId }, { onConflict: "user_id,pattern" });
  }
  revalidateAll();
}

export async function deleteTransaction(txId: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("transactions").delete().eq("id", txId).eq("user_id", user.id);
  revalidateAll();
}

export type { TxKind };

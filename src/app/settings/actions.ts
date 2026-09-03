"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { DEMO_BUDGETS, DEMO_NOTE, generateDemoTransactions } from "@/lib/demo";
import { monthStart } from "@/lib/format";

// Génère un code à 6 chiffres valable 15 minutes pour lier un numéro WhatsApp
export async function generatePairingCode(): Promise<void> {
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await supabase
    .from("profiles")
    .update({ pairing_code: code, pairing_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() })
    .eq("id", user.id);
  revalidatePath("/settings");
}

export async function unlinkWhatsApp(): Promise<void> {
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from("profiles").update({ wa_phone: null }).eq("id", user.id);
  revalidatePath("/settings");
}

function revalidateAll() {
  for (const p of ["/", "/transactions", "/budgets", "/settings"]) revalidatePath(p);
}

// Charge 3 mois de transactions fictives + budgets du mois dans le compte connecté
export async function loadDemoData(): Promise<void> {
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();

  const [{ data: categories }, { data: accounts }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("user_id", user.id),
    supabase.from("accounts").select("id, provider").eq("user_id", user.id),
  ]);
  const catId = (name: string) => categories?.find((c) => c.name === name)?.id ?? null;
  const accountId = (provider: string) => accounts?.find((a) => a.provider === provider)?.id ?? null;

  // Évite les doublons si on clique deux fois
  await supabase.from("transactions").delete().eq("user_id", user.id).eq("note", DEMO_NOTE);

  const rows = generateDemoTransactions().map((t) => ({
    user_id: user.id,
    account_id: accountId(t.provider),
    provider: t.provider,
    direction: t.direction,
    amount: t.amount,
    fee: t.fee,
    counterparty: t.counterparty,
    category_id: catId(t.category),
    kind: t.kind,
    occurred_at: t.occurred_at,
    source: "manual",
    note: DEMO_NOTE,
  }));
  for (let i = 0; i < rows.length; i += 100) {
    await supabase.from("transactions").insert(rows.slice(i, i + 100));
  }

  const month = monthStart();
  const budgets = Object.entries(DEMO_BUDGETS)
    .map(([name, amount]) => ({ user_id: user.id, category_id: catId(name), month, amount }))
    .filter((b) => b.category_id);
  if (budgets.length) {
    await supabase.from("budgets").upsert(budgets, { onConflict: "user_id,category_id,month" });
  }
  revalidateAll();
}

// Supprime uniquement les transactions marquées comme démo (les budgets restent)
export async function clearDemoData(): Promise<void> {
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from("transactions").delete().eq("user_id", user.id).eq("note", DEMO_NOTE);
  revalidateAll();
}

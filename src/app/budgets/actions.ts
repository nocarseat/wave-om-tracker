"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { monthStart } from "@/lib/format";

// Enregistre tous les budgets du formulaire pour le mois courant (0 = supprimé)
export async function saveBudgets(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();
  const month = monthStart();

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("budget:")) continue;
    const categoryId = key.slice("budget:".length);
    const amount = Math.round(Number(String(value).replace(/[^\d]/g, "")));
    if (amount > 0) {
      await supabase
        .from("budgets")
        .upsert({ user_id: user.id, category_id: categoryId, month, amount }, { onConflict: "user_id,category_id,month" });
    } else {
      await supabase.from("budgets").delete().eq("user_id", user.id).eq("category_id", categoryId).eq("month", month);
    }
  }
  revalidatePath("/");
  revalidatePath("/budgets");
}

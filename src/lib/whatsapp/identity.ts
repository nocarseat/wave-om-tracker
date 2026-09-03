import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Un numéro WhatsApp = un compte. Un inconnu qui écrit reçoit un compte créé à la volée
 * (email synthétique, pas de mot de passe). Un utilisateur web existant peut lier son numéro
 * avec le code affiché dans Réglages ("LIER 123456").
 */

const SYNTH_DOMAIN = "wa.sama-depenses.app";

export type WaProfile = { id: string; display_name: string | null; wa_phone: string | null };

export async function findByPhone(admin: SupabaseClient, phone: string): Promise<WaProfile | null> {
  const { data } = await admin
    .from("profiles")
    .select("id, display_name, wa_phone")
    .eq("wa_phone", phone)
    .maybeSingle();
  return (data as WaProfile) ?? null;
}

export async function createForPhone(
  admin: SupabaseClient,
  phone: string,
  displayName: string | null
): Promise<WaProfile> {
  const email = `wa${phone}@${SYNTH_DOMAIN}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: displayName ?? `WhatsApp ${phone}` },
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);

  // Le trigger handle_new_user a créé le profil ; on y attache le numéro
  const { data: profile } = await admin
    .from("profiles")
    .update({ wa_phone: phone })
    .eq("id", data.user.id)
    .select("id, display_name, wa_phone")
    .single();
  return profile as WaProfile;
}

// "LIER 123456" : rattache le numéro au compte web qui a généré ce code
export async function linkWithCode(
  admin: SupabaseClient,
  phone: string,
  code: string
): Promise<{ ok: true; profile: WaProfile } | { ok: false; reason: string }> {
  const { data: target } = await admin
    .from("profiles")
    .select("id, display_name, wa_phone, pairing_expires_at")
    .eq("pairing_code", code)
    .maybeSingle();
  if (!target) return { ok: false, reason: "Code inconnu. Vérifie le code dans Réglages et renvoie LIER suivi du code." };
  if (target.pairing_expires_at && new Date(target.pairing_expires_at) < new Date()) {
    return { ok: false, reason: "Ce code a expiré. Génère un nouveau code dans Réglages." };
  }
  const existing = await findByPhone(admin, phone);
  if (existing && existing.id !== target.id) {
    // Le numéro appartient déjà à un autre compte (souvent créé automatiquement) : on le libère
    await admin.from("profiles").update({ wa_phone: null }).eq("id", existing.id);
  }
  const { data: profile } = await admin
    .from("profiles")
    .update({ wa_phone: phone, pairing_code: null, pairing_expires_at: null })
    .eq("id", target.id)
    .select("id, display_name, wa_phone")
    .single();
  return { ok: true, profile: profile as WaProfile };
}

// Lien de connexion au site sans mot de passe (envoyé sur WhatsApp à la commande SITE)
export async function loginLink(admin: SupabaseClient, userId: string, siteUrl: string): Promise<string | null> {
  const { data: user } = await admin.auth.admin.getUserById(userId);
  const email = user.user?.email;
  if (!email) return null;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${siteUrl}/auth/callback` },
  });
  if (error) return null;
  return data.properties?.action_link ?? null;
}

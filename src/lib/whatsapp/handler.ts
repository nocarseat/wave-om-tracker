import type { SupabaseClient } from "@supabase/supabase-js";
import { answerMoneyQuestion, parseImageTransactions } from "@/lib/claude";
import { fcfa } from "@/lib/format";
import { loadContext, recordParsedTx } from "@/lib/ingest";
import { parseQuickLog } from "@/lib/quicklog";
import { parseSms } from "@/lib/sms";
import { monthSummary, summaryFooter, summaryForModel } from "@/lib/summary";
import { PROVIDER_LABEL, type ParsedTx } from "@/lib/types";
import { downloadMedia, type InboundMessage } from "./cloud";
import { createForPhone, findByPhone, linkWithCode, loginLink, type WaProfile } from "./identity";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sama-depenses.netlify.app";

const HELP = `Voici ce que tu peux m'envoyer :
- Un SMS Wave ou Orange Money transféré tel quel
- Une capture de ton historique Wave ou Orange Money, ou la photo d'un reçu
- Un montant et un mot : "1500 taxi", "2500 pain om", "+50000 salaire"
- Une question : "combien ce mois ?", "mes frais", "transport", "qui j'ai payé"
Commandes : BILAN, ANNULER (retire le dernier import), SITE (lien vers ton tableau de bord), AIDE.`;

export type HandleResult = { userId: string | null; reply: string; status: "handled" | "ignored" };

// Point d'entrée : un message entrant -> une réponse texte
export async function handleInbound(admin: SupabaseClient, msg: InboundMessage): Promise<HandleResult> {
  const text = (msg.text ?? "").trim();
  const upper = text.toUpperCase();

  // Liaison avec un compte web : traitée avant toute création automatique de compte
  const link = upper.match(/^(?:LIER|LINK|CODE)\s+(\d{6})$/);
  if (link) {
    const r = await linkWithCode(admin, msg.from, link[1]);
    return r.ok
      ? { userId: r.profile.id, reply: `C'est lié. Ce numéro est maintenant rattaché à ton compte${r.profile.display_name ? ` (${r.profile.display_name})` : ""}. Envoie AIDE pour voir ce que je sais faire.`, status: "handled" }
      : { userId: null, reply: r.reason, status: "handled" };
  }

  let profile: WaProfile | null = await findByPhone(admin, msg.from);
  const isNew = !profile;
  if (!profile) profile = await createForPhone(admin, msg.from, msg.profileName);
  const userId = profile.id;

  if (msg.type === "image" && msg.mediaId) {
    return { userId, reply: await handleImage(admin, userId, msg), status: "handled" };
  }
  if (msg.type === "audio") {
    return { userId, reply: "Les vocaux arrivent bientôt. Pour l'instant, écris-moi le montant et un mot, par exemple : 1500 taxi.", status: "handled" };
  }
  if (msg.type !== "text" || !text) {
    return { userId, reply: "Je ne sais lire que du texte et des images pour l'instant.\n\n" + HELP, status: "ignored" };
  }

  if (isNew) {
    const first = await routeText(admin, userId, text);
    return {
      userId,
      reply: `Bienvenue${msg.profileName ? ` ${msg.profileName}` : ""}. Je garde la trace de tes dépenses Wave et Orange Money.\n\n${first}`,
      status: "handled",
    };
  }
  return { userId, reply: await routeText(admin, userId, text), status: "handled" };
}

async function routeText(admin: SupabaseClient, userId: string, text: string): Promise<string> {
  const upper = text.toUpperCase();

  if (["AIDE", "HELP", "MENU", "?"].includes(upper)) return HELP;

  if (["BILAN", "RESUME", "RÉSUMÉ", "SOLDE", "TOTAL"].includes(upper)) {
    return await bilan(admin, userId);
  }

  if (["ANNULER", "UNDO"].includes(upper)) {
    return await undoLastImport(admin, userId);
  }

  if (["SITE", "LIEN", "DASHBOARD", "TABLEAU"].includes(upper)) {
    const url = await loginLink(admin, userId, SITE_URL);
    return url
      ? `Ton tableau de bord (lien valable une heure, à ouvrir sur ce téléphone) :\n${url}`
      : `Ton tableau de bord : ${SITE_URL}`;
  }

  // 1. SMS Wave / Orange Money transféré
  const sms = parseSms(null, text);
  if (sms && sms.provider !== "other") {
    const r = await recordParsedTx(admin, userId, sms, { source: "sms", rawText: text });
    if (r.status === "duplicate") return "Déjà enregistré, rien à ajouter.";
    if (r.status === "error") return `Je n'ai pas pu enregistrer : ${r.message}`;
    return `${describe(sms)}\n${summaryFooter(await monthSummary(admin, userId))}`;
  }

  // 2. Saisie rapide "1500 taxi"
  const quick = parseQuickLog(text);
  if (quick && !looksLikeQuestion(text)) {
    const r = await recordParsedTx(admin, userId, quick, { source: "manual", rawText: text });
    if (r.status === "error") return `Je n'ai pas pu enregistrer : ${r.message}`;
    return `${describe(quick)}\n${summaryFooter(await monthSummary(admin, userId))}`;
  }

  // 3. Question libre : Claude répond avec le résumé du mois en contexte
  const s = await monthSummary(admin, userId);
  if (s.count === 0) {
    return "Je n'ai encore aucune opération pour toi ce mois-ci.\n\n" + HELP;
  }
  try {
    return await answerMoneyQuestion(text, summaryForModel(s));
  } catch {
    return await bilan(admin, userId);
  }
}

function looksLikeQuestion(text: string): boolean {
  return /\?|\bcombien\b|\bquel|\bqui\b|\bmes\b|\bmon\b|\bbudget\b|\bfrais\b/i.test(text);
}

async function handleImage(admin: SupabaseClient, userId: string, msg: InboundMessage): Promise<string> {
  const { data, mimeType } = await downloadMedia(msg.mediaId!);
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
  type Allowed = (typeof allowed)[number];
  if (!allowed.includes(mimeType as Allowed)) return "Format d'image non pris en charge. Envoie une capture ou une photo en JPEG ou PNG.";

  const items = await parseImageTransactions(data.toString("base64"), mimeType as Allowed, msg.caption ?? undefined);
  if (items.length === 0) return "Je n'ai rien pu lire sur cette image. Essaie une capture plus nette de l'historique, ou la photo du reçu bien à plat.";

  const ctx = await loadContext(admin, userId);
  const batch = `wa:${msg.id}`;
  let inserted = 0;
  let duplicates = 0;
  const lines: string[] = [];
  for (const it of items) {
    const r = await recordParsedTx(admin, userId, it, {
      source: it.provider === "other" ? "receipt" : "screenshot",
      rawText: batch,
      ctx,
    });
    if (r.status === "inserted") {
      inserted++;
      if (lines.length < 6) lines.push(describe(it, true));
    } else if (r.status === "duplicate") duplicates++;
  }
  const head =
    inserted === 0
      ? `Rien de nouveau : ${duplicates} opération${duplicates > 1 ? "s" : ""} déjà connue${duplicates > 1 ? "s" : ""}.`
      : `${inserted} opération${inserted > 1 ? "s" : ""} enregistrée${inserted > 1 ? "s" : ""}${duplicates ? `, ${duplicates} déjà connue${duplicates > 1 ? "s" : ""}` : ""} :`;
  const tail = inserted > 0 ? `\n${summaryFooter(await monthSummary(admin, userId))}\nEnvoie ANNULER si l'import est faux.` : "";
  return [head, ...lines, items.length > 6 && inserted > 6 ? "..." : "", tail].filter(Boolean).join("\n");
}

async function undoLastImport(admin: SupabaseClient, userId: string): Promise<string> {
  const { data: last } = await admin
    .from("transactions")
    .select("raw_text")
    .eq("user_id", userId)
    .like("raw_text", "wa:%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last?.raw_text) return "Aucun import WhatsApp à annuler.";
  const { count } = await admin
    .from("transactions")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("raw_text", last.raw_text);
  return `${count ?? 0} opération${(count ?? 0) > 1 ? "s" : ""} retirée${(count ?? 0) > 1 ? "s" : ""}.`;
}

async function bilan(admin: SupabaseClient, userId: string): Promise<string> {
  const s = await monthSummary(admin, userId);
  if (s.count === 0) return "Aucune opération ce mois-ci pour l'instant.\n\n" + HELP;
  const cats = s.byCategory.slice(0, 5).map((c) => `- ${c.name} : ${fcfa(c.spent)}${c.budget ? ` / ${fcfa(c.budget)}` : ""}`);
  return [
    `${s.label} : ${fcfa(s.spent)} dépensés (Wave ${fcfa(s.byProvider.wave)}, Orange Money ${fcfa(s.byProvider.orange_money)}).`,
    s.income ? `Entrées : ${fcfa(s.income)}.` : "",
    s.fees ? `Frais opérateur : ${fcfa(s.fees)}.` : "",
    ...cats,
    s.budgetTotal ? (s.budgetTotal - s.spent >= 0 ? `Reste ${fcfa(s.budgetTotal - s.spent)} sur ton budget.` : `Budget dépassé de ${fcfa(s.spent - s.budgetTotal)}.`) : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function describe(t: ParsedTx, short = false): string {
  const who = t.counterparty ? ` ${t.direction === "credit" ? "de" : "à"} ${t.counterparty}` : "";
  const via = t.provider === "other" ? "" : ` (${PROVIDER_LABEL[t.provider]})`;
  const fee = t.fee ? `, frais ${fcfa(t.fee)}` : "";
  return `${short ? "- " : "Noté : "}${t.direction === "credit" ? "+" : "-"}${fcfa(t.amount)}${who}${via}${fee}`;
}

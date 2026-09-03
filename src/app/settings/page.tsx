import { headers } from "next/headers";
import { Shell } from "@/components/Shell";
import { createClient, getUser } from "@/lib/supabase/server";
import { DEMO_NOTE } from "@/lib/demo";
import { clearDemoData, generatePairingCode, loadDemoData, unlinkWhatsApp } from "./actions";

export default async function SettingsPage() {
  const user = await getUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("ingest_token, display_name, wa_phone, pairing_code, pairing_expires_at")
    .eq("id", user!.id)
    .single();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const webhookUrl = `${proto}://${host}/api/ingest/sms`;
  const token = profile?.ingest_token ?? "";
  const botNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
  const codeActive =
    profile?.pairing_code && profile.pairing_expires_at && new Date(profile.pairing_expires_at) > new Date();

  const [{ count: smsCount }, { count: demoCount }] = await Promise.all([
    supabase.from("inbound_sms").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("note", DEMO_NOTE),
  ]);

  return (
    <Shell
      title="Réglages"
      action={
        <form action="/auth/signout" method="post">
          <button className="text-sm text-ink-muted underline-offset-4 hover:underline" type="submit">
            Se déconnecter
          </button>
        </form>
      }
    >
      <section className="card p-4">
        <p className="text-sm text-ink-muted">Connecté en tant que</p>
        <p className="text-sm">{user?.email}</p>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="text-base font-medium">WhatsApp</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Envoie tes SMS Wave et Orange Money, tes captures d&apos;écran ou simplement « 1500 taxi » au numéro de
          l&apos;app, et pose-lui tes questions. Tout arrive ici.
        </p>
        {botNumber && (
          <p className="mt-2 text-sm">
            Numéro de l&apos;app :{" "}
            <a className="font-mono underline underline-offset-4" href={`https://wa.me/${botNumber.replace(/\D/g, "")}?text=AIDE`}>
              {botNumber}
            </a>
          </p>
        )}
        {profile?.wa_phone ? (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span>Numéro lié : +{profile.wa_phone}</span>
            <form action={unlinkWhatsApp}>
              <button className="text-ink-muted underline-offset-4 hover:underline" type="submit">Délier</button>
            </form>
          </div>
        ) : (
          <div className="mt-3">
            {codeActive ? (
              <p className="text-sm">
                Envoie <span className="rounded-lg bg-surface px-2 py-1 font-mono">LIER {profile?.pairing_code}</span> au numéro
                de l&apos;app depuis ton WhatsApp (code valable 15 minutes).
              </p>
            ) : (
              <form action={generatePairingCode}>
                <button className="btn btn-quiet w-full" type="submit">Lier mon WhatsApp</button>
              </form>
            )}
          </div>
        )}
      </section>

      <section className="card mt-4 p-4">
        <h2 className="text-base font-medium">Capture automatique des SMS (Android)</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Une app de transfert de SMS envoie chaque notification Wave ou Orange Money à l&apos;adresse ci-dessous. Les opérations
          apparaissent alors sans rien saisir.
        </p>

        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="text-ink-muted">Adresse (webhook)</dt>
            <dd className="mt-1 break-all rounded-lg bg-surface px-3 py-2 font-mono text-xs">{webhookUrl}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Jeton personnel (header x-ingest-token)</dt>
            <dd className="mt-1 break-all rounded-lg bg-surface px-3 py-2 font-mono text-xs">{token}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">SMS reçus jusqu&apos;ici</dt>
            <dd className="mt-1">{smsCount ?? 0}</dd>
          </div>
        </dl>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">Configurer avec MacroDroid (gratuit)</summary>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-ink-muted">
            <li>Installez MacroDroid depuis le Play Store et autorisez l&apos;accès aux SMS.</li>
            <li>Nouvelle macro. Déclencheur : « SMS reçu », expéditeur contient « Wave ». Ajoutez un second déclencheur pour « Orange » (ou « OM »).</li>
            <li>
              Action : « Requête HTTP », méthode POST, URL = l&apos;adresse ci-dessus. En-tête personnalisé :{" "}
              <span className="font-mono">x-ingest-token</span> = votre jeton. Type de contenu JSON, corps :
              <pre className="mt-1 overflow-x-auto rounded-lg bg-surface p-2 font-mono text-xs text-ink">{`{"sender": "{sms_name}", "body": "{sms_message}"}`}</pre>
            </li>
            <li>Enregistrez, puis envoyez-vous 100 F sur Wave pour tester : l&apos;opération doit apparaître dans Opérations.</li>
          </ol>
          <p className="mt-2 text-xs text-ink-muted">
            iPhone : la lecture des SMS n&apos;est pas possible. Utilisez Importer avec une capture de l&apos;historique.
          </p>
        </details>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="text-base font-medium">Données de démo</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Trois mois de dépenses fictives (Wave et Orange Money) et des budgets pour le mois en cours, pour tester
          l&apos;app sans attendre de vraies opérations.
          {demoCount ? ` ${demoCount} opérations de démo sont chargées.` : ""}
        </p>
        <div className="mt-3 flex gap-2">
          <form action={loadDemoData} className="flex-1">
            <button className="btn w-full" type="submit">
              {demoCount ? "Recharger la démo" : "Charger la démo"}
            </button>
          </form>
          {demoCount ? (
            <form action={clearDemoData} className="flex-1">
              <button className="btn btn-quiet w-full" type="submit">
                Supprimer la démo
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="text-base font-medium">Installer sur l&apos;écran d&apos;accueil</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Android (Chrome) : menu ⋮ puis « Ajouter à l&apos;écran d&apos;accueil ». iPhone (Safari) : Partager puis « Sur l&apos;écran d&apos;accueil ».
        </p>
      </section>
    </Shell>
  );
}

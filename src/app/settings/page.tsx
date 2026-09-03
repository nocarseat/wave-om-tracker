import { headers } from "next/headers";
import { Shell } from "@/components/Shell";
import { createClient, getUser } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const user = await getUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("ingest_token, display_name")
    .eq("id", user!.id)
    .single();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const webhookUrl = `${proto}://${host}/api/ingest/sms`;
  const token = profile?.ingest_token ?? "";

  const { count: smsCount } = await supabase
    .from("inbound_sms")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id);

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
        <h2 className="text-base font-medium">Installer sur l&apos;écran d&apos;accueil</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Android (Chrome) : menu ⋮ puis « Ajouter à l&apos;écran d&apos;accueil ». iPhone (Safari) : Partager puis « Sur l&apos;écran d&apos;accueil ».
        </p>
      </section>
    </Shell>
  );
}

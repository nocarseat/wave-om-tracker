"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/app";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(
    params.get("error") === "confirmation"
      ? "Le lien de confirmation n'est plus valide. Connectez-vous avec votre mot de passe, ou créez à nouveau votre compte."
      : null
  );
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            // Le lien de confirmation revient sur l'app (et non sur le Site URL Supabase par défaut)
            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
          });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (mode === "signup") {
      setMessage(
        "Compte créé. Si la confirmation par email est activée dans Supabase, vérifiez votre boîte mail, sinon connectez-vous."
      );
      setMode("signin");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <p className="mb-1 text-sm text-ink-muted">Wave et Orange Money</p>
      <h1 className="mb-8 text-[28px] font-medium tracking-tight">{APP_NAME}</h1>

      <div className="card space-y-3 p-5">
        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">Email</span>
          <input
            className="field"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">Mot de passe</span>
          <input
            className="field"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {message && <p className="text-sm text-over">{message}</p>}
        <button className="btn w-full" onClick={submit} disabled={busy || !email || password.length < 6}>
          {busy ? "Un instant" : mode === "signin" ? "Se connecter" : "Créer mon compte"}
        </button>
        <button
          type="button"
          className="w-full py-1 text-sm text-ink-muted underline-offset-4 hover:underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Pas encore de compte ? Créer un compte" : "Déjà inscrit ? Se connecter"}
        </button>
      </div>
    </div>
  );
}

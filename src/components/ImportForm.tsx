"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveImported } from "@/app/transactions/actions";
import { fcfa } from "@/lib/format";
import { KIND_LABEL, PROVIDER_LABEL, type ParsedTx } from "@/lib/types";

type Mode = "screenshot" | "receipt";

// Photo ou capture -> Claude extrait les opérations -> l'utilisateur vérifie -> enregistrement
export function ImportForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("screenshot");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [items, setItems] = useState<ParsedTx[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, startSave] = useTransition();

  function pick(f: File | null) {
    setFile(f);
    setItems(null);
    setStatus(null);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function analyze() {
    if (!file) return;
    setAnalyzing(true);
    setStatus(null);
    const fd = new FormData();
    fd.set("file", file);
    if (hint.trim()) fd.set("hint", hint.trim());
    try {
      const res = await fetch("/api/parse-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur d'analyse");
      setItems(data.transactions);
      if (data.transactions.length === 0) setStatus("Aucune opération lisible sur cette image.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Erreur d'analyse");
    } finally {
      setAnalyzing(false);
    }
  }

  function update(i: number, patch: Partial<ParsedTx>) {
    setItems((prev) => prev?.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) ?? null);
  }

  function save() {
    if (!items?.length) return;
    startSave(async () => {
      const r = await saveImported(JSON.stringify(items), mode);
      setStatus(
        `${r.inserted} opération${r.inserted > 1 ? "s" : ""} enregistrée${r.inserted > 1 ? "s" : ""}` +
          (r.duplicates ? `, ${r.duplicates} déjà présente${r.duplicates > 1 ? "s" : ""}` : "") + "."
      );
      setItems(null);
      pick(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex gap-2">
          {(["screenshot", "receipt"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                mode === m ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink-muted"
              }`}
            >
              {m === "screenshot" ? "Capture Wave / OM" : "Reçu papier"}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-muted">
          {mode === "screenshot"
            ? "Faites une capture de l'historique dans l'app Wave ou Orange Money. Plusieurs opérations peuvent être lues d'un coup."
            : "Prenez le ticket en photo, bien à plat et éclairé. Le total payé sera enregistré."}
        </p>

        <label className="btn btn-quiet mt-3 w-full cursor-pointer">
          {file ? "Changer d'image" : mode === "receipt" ? "Prendre une photo" : "Choisir une capture"}
          <input
            type="file"
            accept="image/*"
            capture={mode === "receipt" ? "environment" : undefined}
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </label>

        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Aperçu" className="mt-3 max-h-64 w-full rounded-lg object-contain bg-surface" />
        )}

        {file && !items && (
          <>
            <input
              className="field mt-3"
              placeholder="Indication facultative : compte Wave, mois d'août..."
              value={hint}
              onChange={(e) => setHint(e.target.value)}
            />
            <button className="btn mt-3 w-full" onClick={analyze} disabled={analyzing}>
              {analyzing ? "Lecture en cours" : "Lire les opérations"}
            </button>
          </>
        )}
        {status && <p className="mt-3 text-sm text-ink-muted">{status}</p>}
      </div>

      {items && items.length > 0 && (
        <div className="card p-4">
          <h2 className="text-base font-medium">Vérifiez avant d&apos;enregistrer</h2>
          <ul className="mt-3 divide-y divide-line">
            {items.map((it, i) => (
              <li key={i} className="space-y-2 py-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="field"
                    inputMode="numeric"
                    value={it.amount}
                    onChange={(e) => update(i, { amount: Number(e.target.value.replace(/[^\d]/g, "")) })}
                    aria-label="Montant"
                  />
                  <select
                    className="field"
                    value={it.direction}
                    onChange={(e) => update(i, { direction: e.target.value as ParsedTx["direction"] })}
                    aria-label="Sens"
                  >
                    <option value="debit">Dépense</option>
                    <option value="credit">Entrée</option>
                  </select>
                </div>
                <input
                  className="field"
                  value={it.counterparty ?? ""}
                  placeholder="Marchand ou personne"
                  onChange={(e) => update(i, { counterparty: e.target.value || null })}
                  aria-label="Contrepartie"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="field"
                    value={it.provider}
                    onChange={(e) => update(i, { provider: e.target.value as ParsedTx["provider"] })}
                    aria-label="Compte"
                  >
                    {Object.entries(PROVIDER_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <select
                    className="field"
                    value={it.kind}
                    onChange={(e) => update(i, { kind: e.target.value as ParsedTx["kind"] })}
                    aria-label="Type"
                  >
                    {Object.entries(KIND_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span>
                    {it.occurred_at ? new Date(it.occurred_at).toLocaleDateString("fr-FR") : "Date : aujourd'hui"}
                    {it.fee ? `, frais ${fcfa(it.fee)}` : ""}
                  </span>
                  <button
                    type="button"
                    className="underline-offset-4 hover:underline"
                    onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                  >
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button className="btn mt-3 w-full" onClick={save} disabled={saving}>
            {saving ? "Enregistrement" : `Enregistrer ${items.length} opération${items.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}

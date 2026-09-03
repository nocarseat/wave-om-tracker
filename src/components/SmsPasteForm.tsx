"use client";

import { useState, useTransition } from "react";
import { addFromSmsText } from "@/app/transactions/actions";

export function SmsPasteForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [sms, setSms] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="card p-4">
      <h2 className="text-base font-medium">Coller un SMS</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Copiez le SMS de confirmation Wave ou Orange Money et collez-le ici.
      </p>
      <textarea
        className="field mt-3 min-h-24"
        placeholder="Vous avez envoyé 5,000F à ..."
        value={sms}
        onChange={(e) => setSms(e.target.value)}
      />
      {message && <p className="mt-2 text-sm text-ink-muted">{message}</p>}
      <button
        className="btn mt-3 w-full"
        disabled={pending || !sms.trim()}
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set("sms", sms);
            const r = await addFromSmsText(fd);
            setMessage(r.message);
            if (r.ok) setSms("");
          })
        }
      >
        {pending ? "Analyse" : "Ajouter depuis le SMS"}
      </button>
    </div>
  );
}

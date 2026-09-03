import type { Provider } from "@/lib/types";

// Pastille de couleur opérateur : bleu Wave, orange Orange Money, gris sinon
export function ProviderMark({ provider, size = 10 }: { provider: Provider; size?: number }) {
  const color =
    provider === "wave" ? "bg-wave" : provider === "orange_money" ? "bg-om" : "bg-ink-muted";
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${color}`}
      style={{ width: size, height: size }}
    />
  );
}

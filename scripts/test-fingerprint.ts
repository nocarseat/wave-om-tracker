// npm run test:fp : trois lignes d'une même capture ne doivent pas se dédupliquer entre elles
import { fingerprintFor } from "../src/lib/sms.ts";
const base = { provider: "wave" as const, fee: 0, kind: "transfer" as const, reference: null, balance_after: null };
const items = [
  { ...base, direction: "debit" as const, amount: 20200, counterparty: "ARISTIDE N", occurred_at: "2026-09-03T13:25:00.000Z" },
  { ...base, direction: "debit" as const, amount: 6000, counterparty: "Airtime", occurred_at: "2026-09-03T13:19:00.000Z" },
  { ...base, direction: "credit" as const, amount: 25500, counterparty: "Maria C T", occurred_at: "2026-09-03T11:56:00.000Z" },
];
const now = new Date();
const fps = items.map((it) => fingerprintFor(it, "wa:wamid.X", now));
console.log(fps);
console.log(new Set(fps).size === 3 ? "OK : 3 empreintes distinctes" : "ERREUR : collision");

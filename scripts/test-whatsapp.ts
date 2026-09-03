// Tests hors-ligne des briques WhatsApp :  npm run test:wa
import { parseQuickLog } from "../src/lib/quicklog.ts";
import { extractMessages, verifySignature } from "../src/lib/whatsapp/cloud.ts";
import { createHmac } from "crypto";

const quick = ["1500 taxi", "2 500 pain om", "taxi 1500 wave", "+50000 salaire", "reçu 10000 de moussa", "combien ce mois ?", "5000F crédit orange", "Bonjour"];
for (const q of quick) console.log(q.padEnd(24), "->", JSON.stringify(parseQuickLog(q)));

const payload = {
  entry: [{ changes: [{ value: {
    contacts: [{ wa_id: "221771234567", profile: { name: "Awa" } }],
    messages: [
      { id: "wamid.1", from: "221771234567", type: "text", text: { body: "1500 taxi" } },
      { id: "wamid.2", from: "221771234567", type: "image", image: { id: "media-1", mime_type: "image/jpeg", caption: "août" } },
    ],
  } }] }],
};
console.log("\nextractMessages:", JSON.stringify(extractMessages(payload)));

process.env.WHATSAPP_APP_SECRET = "s3cret";
const raw = JSON.stringify(payload);
const sig = "sha256=" + createHmac("sha256", "s3cret").update(raw).digest("hex");
console.log("signature ok:", verifySignature(raw, sig), "| bad:", verifySignature(raw, "sha256=00"));

// Test manuel du parseur SMS :  npm run test:sms
import { parseSms } from "../src/lib/sms.ts";
import { SAMPLES } from "../src/lib/sms.samples.ts";

let ok = 0;
for (const s of SAMPLES) {
  const r = parseSms(s.sender, s.body);
  console.log("\n" + s.body);
  console.log(r ? JSON.stringify(r) : "!! NON RECONNU");
  if (r) ok++;
}
console.log(`\n${ok}/${SAMPLES.length} SMS reconnus`);

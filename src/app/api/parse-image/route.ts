import { NextResponse, type NextRequest } from "next/server";
import { parseImageTransactions } from "@/lib/claude";
import { getUser } from "@/lib/supabase/server";

const ALLOWED = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type Allowed = (typeof ALLOWED)[number];

// Reçoit une image (capture d'écran ou reçu) et renvoie les transactions extraites par Claude,
// sans les enregistrer : l'utilisateur confirme d'abord dans la page Importer.
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const hint = form.get("hint");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucune image reçue" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type as Allowed)) {
    return NextResponse.json({ error: `Format non pris en charge : ${file.type}` }, { status: 415 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Image trop lourde (max 8 Mo)" }, { status: 413 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  try {
    const transactions = await parseImageTransactions(
      base64,
      file.type as Allowed,
      typeof hint === "string" && hint.trim() ? hint.trim() : undefined
    );
    return NextResponse.json({ transactions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

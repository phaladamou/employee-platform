// app/api/onboarding/route.ts
//
// Reste a la racine de app/api : place sous app/(chat)/api, cette route
// heriterait du layout (chat) qui redirige les non-onboardes — donc
// l'appel POST d'onboarding lui-meme serait intercepte (bug "Connection
// lost" a la validation du profil).
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/app/(auth)/auth";
import { getDb } from "@/lib/db/client";
import { getFirstChatIdForUser } from "@/lib/db/queries";
import { user } from "@/lib/db/schema";

const INTENTS = ["solo", "startup", "enterprise"] as const;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const intent = typeof body.intent === "string" ? body.intent : "";
  const company = typeof body.company === "string" ? body.company.trim() : "";

  if (!name || name.length > 120) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }
  if (!(INTENTS as readonly string[]).includes(intent)) {
    return NextResponse.json({ error: "Invalid intent" }, { status: 400 });
  }
  if (body.terms !== true) {
    return NextResponse.json({ error: "Terms required" }, { status: 400 });
  }
  if (title.length > 120 || company.length > 160) {
    return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  }

  const db = await getDb();
  await db
    .update(user)
    .set({
      name,
      title: title || null,
      intent,
      company: company || null,
      onboarded: true,
    })
    .where(eq(user.id, session.user.id));

  // Le nouvel utilisateur atterrit sur le chat de son Chef.
  const chatId = await getFirstChatIdForUser(session.user.id);
  return NextResponse.json({ ok: true, chatId });
}

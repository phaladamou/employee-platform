// app/(chat)/websites/api/chat/route.ts

import { auth } from "@/app/(auth)/auth";
import { saveChat } from "@/lib/db/queries";
import { getLocalServerBaseUrl } from "@/lib/utils";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const chatId = body.id;

  if (!chatId) {
    return new Response("Missing chat id", { status: 400 });
  }

  await saveChat({
    id: chatId,
    userId: session.user.id,
    title: body.message?.parts?.[0]?.text?.slice(0, 80) || "Website Chat",
    visibility: body.selectedVisibilityType ?? "private",
  });

  // Pas de saveMessages ici : /api/chat persiste deja le message
  // utilisateur (double ecriture = violation de cle primaire).
  // Proxy vers le chat principal sur CE serveur (port dynamique en bureau).
  const aiResponse = await fetch(
    `${getLocalServerBaseUrl(request)}/api/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify(body),
    }
  );

  return new Response(aiResponse.body, {
    status: aiResponse.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

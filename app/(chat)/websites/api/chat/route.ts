// app/(chat)/websites/api/chat/route.ts

import { auth } from "@/app/(auth)/auth";
import { saveChat, saveMessages } from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";

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

  if (body.message) {
    await saveMessages({
      messages: [
        {
          chatId,
          id: body.message.id ?? generateUUID(),
          role: body.message.role,
          parts: body.message.parts,
          attachments: body.message.attachments ?? [],
          createdAt: new Date(),
        },
      ],
    });
  }

  const aiResponse = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/chat`,
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

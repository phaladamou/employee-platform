// app/(chat)/websites/api/messages/route.ts
import { auth } from "@/app/(auth)/auth";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return new Response("Missing chatId", { status: 400 });
  }

  const chat = await getChatById({ id: chatId });
  if (!chat || chat.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const messages = await getMessagesByChatId({ id: chatId });

  return Response.json({
    messages,
    visibility: chat.visibility,
  });
}

// app/(chat)/api/notifications/read/route.ts
import { auth } from "@/app/(auth)/auth";
import { markAllNotificationsAsRead } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  await markAllNotificationsAsRead({ userId: session.user.id });

  return Response.json({ success: true });
}

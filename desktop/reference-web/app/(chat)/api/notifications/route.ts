// app/(chat)/api/notifications/route.ts
import { auth } from "@/app/(auth)/auth";
import {
  getNotificationsByUserId,
  getUnreadNotificationsCount,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const [items, unreadCount] = await Promise.all([
    getNotificationsByUserId({ userId: session.user.id }),
    getUnreadNotificationsCount({ userId: session.user.id }),
  ]);

  return Response.json({ notifications: items, unreadCount });
}

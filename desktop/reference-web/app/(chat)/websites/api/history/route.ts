// app/(chat)/websites/api/history/route.ts
import { auth } from "@/app/(auth)/auth";
import { getChatsByUserId } from "@/lib/db/queries";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 20);

  const chats = await getChatsByUserId({
    id: session.user.id,
    limit,
    startingAfter: null,
    endingBefore: null,
  });

  return Response.json(chats);
}

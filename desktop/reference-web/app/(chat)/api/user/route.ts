// app/api/user/route.ts
import { auth } from "@/app/(auth)/auth";
import { getUser } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const userRecord = await getUser(session.user.email ?? "");
  const user = userRecord[0];

  return Response.json({
    user: {
      id: user?.id ?? session.user.id,
      name: user?.name ?? session.user.name,
      email: user?.email ?? session.user.email,
      image: user?.image ?? session.user.image,
      bio: user?.bio ?? null,
    },
  });
}
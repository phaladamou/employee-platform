// app/(chat)/api/connectors/route.ts
import { auth } from "@/app/(auth)/auth";
import { listProviders } from "@/lib/connectors";
import { getConnectorsByUserId } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const rows = await getConnectorsByUserId({ userId: session.user.id });
  const connectedSet = new Set(rows.map((r) => r.provider));

  const providers = listProviders().map((p) => ({
    ...p,
    connected: connectedSet.has(p.id),
  }));

  return Response.json({ providers });
}

// app/(chat)/api/connectors/[provider]/disconnect/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getProvider } from "@/lib/connectors";
import {
  createNotification,
  deleteConnector,
  getConnector,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerId } = await params;

  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const provider = getProvider(providerId);
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const existing = await getConnector({
    userId: session.user.id,
    provider: providerId,
  });

  if (existing.length === 0) {
    return NextResponse.json({ success: true });
  }

  await deleteConnector({
    userId: session.user.id,
    provider: providerId,
  });

  await createNotification({
    userId: session.user.id,
    type: "oauth_disconnected",
    provider: providerId,
    title: "events.oauthDisconnected",
  });

  return NextResponse.json({ success: true });
}

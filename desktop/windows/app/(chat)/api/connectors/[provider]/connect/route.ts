// app/(chat)/api/connectors/[provider]/connect/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  buildAuthorizeUrl,
  generateState,
  getProvider,
  signState,
} from "@/lib/connectors";
import { ChatbotError } from "@/lib/errors";

const STATE_COOKIE_MAX_AGE = 60 * 10;

export async function GET(
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

  if (!provider.configured) {
    return NextResponse.json(
      { error: `${provider.displayName} is not configured yet` },
      { status: 501 }
    );
  }

  const state = generateState();
  const signedState = signState(state);

  const cookieStore = await cookies();
  cookieStore.set(`oauth_state_${providerId}`, signedState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_COOKIE_MAX_AGE,
  });

  const authorizeUrl = buildAuthorizeUrl(provider.oauth, state);

  return NextResponse.redirect(authorizeUrl);
}

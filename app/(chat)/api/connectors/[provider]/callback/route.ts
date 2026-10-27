// app/(chat)/api/connectors/[provider]/callback/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  encryptToken,
  exchangeCode,
  getProvider,
  verifyState,
} from "@/lib/connectors";
import { createNotification, upsertConnector } from "@/lib/db/queries";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

function redirect(path: string) {
  return NextResponse.redirect(`${APP_URL}${path}`);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerId } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const session = await auth();
  if (!session?.user) {
    return redirect("/computer/connectors/callback?error=unauthorized");
  }

  const provider = getProvider(providerId);
  if (!provider) {
    return redirect("/computer/connectors/callback?error=unknown_provider");
  }

  const cookieStore = await cookies();
  const signedState = cookieStore.get(`oauth_state_${providerId}`)?.value;
  cookieStore.delete(`oauth_state_${providerId}`);

  if (!signedState || !state) {
    return redirect("/computer/connectors/callback?error=missing_state");
  }

  const verified = verifyState(signedState);
  if (!verified || verified !== state) {
    return redirect("/computer/connectors/callback?error=invalid_state");
  }

  if (!code) {
    return redirect("/computer/connectors/callback?error=missing_code");
  }

  try {
    const tokenData = await exchangeCode(provider.oauth, code);

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    await upsertConnector({
      userId: session.user.id,
      provider: providerId,
      accessToken: encryptToken(tokenData.access_token),
      refreshToken: tokenData.refresh_token
        ? encryptToken(tokenData.refresh_token)
        : null,
      expiresAt,
      scope:
        tokenData.scope ??
        (provider.oauth.scopes.length > 0
          ? provider.oauth.scopes.join(" ")
          : null),
    });

    await createNotification({
      userId: session.user.id,
      type: "oauth_connected",
      provider: providerId,
      title: "events.oauthConnected",
    });

    return redirect(`/computer/connectors/callback?connected=${providerId}`);
  } catch (error) {
    console.error("OAuth callback error:", error);

    try {
      await createNotification({
        userId: session.user.id,
        type: "oauth_error",
        provider: providerId,
        title: "events.oauthError",
      });
    } catch (notifError) {
      console.error("Failed to create error notification:", notifError);
    }

    return redirect("/computer/connectors/callback?error=token_exchange");
  }
}

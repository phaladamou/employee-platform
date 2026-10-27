import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { NextResponse } from "next/server";
import postgres from "postgres";
import { userSettings } from "@/lib/db/schema";

const client = postgres(process.env.POSTGRES_URL ?? "", {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});
const db = drizzle(client);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state") ?? "";

  if (!code) {
    return new Response("Missing code", { status: 400 });
  }

  try {
    const codeVerifier = "scientia-labs-link-challenge";
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/link/twitter/callback`;

    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${process.env.AUTH_TWITTER_ID}:${process.env.AUTH_TWITTER_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return new Response(`Twitter error: ${tokenData.error_description}`, {
        status: 400,
      });
    }

    const userRes = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    await saveLinkedAccount(userId, "twitter", {
      id: userData.data.id,
      name: userData.data.name,
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/settings/general`
    );
  } catch (error) {
    console.error("Twitter link error:", error);
    return new Response("Internal error", { status: 500 });
  }
}

async function saveLinkedAccount(
  userId: string,
  provider: string,
  data: { id: string; name: string }
) {
  const [existing] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  const prefs = (existing?.preferences as Record<string, unknown>) ?? {};
  const linkedAccounts =
    (prefs.linkedAccounts as Record<string, unknown>) ?? {};

  const newLinked = { ...linkedAccounts, [provider]: data };

  if (existing) {
    await db
      .update(userSettings)
      .set({
        preferences: { ...prefs, linkedAccounts: newLinked },
        updatedAt: new Date(),
      } as any)
      .where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({
      userId,
      preferences: { linkedAccounts: newLinked },
    } as any);
  }
}
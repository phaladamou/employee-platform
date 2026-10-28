import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { userSettings } from "@/lib/db/schema";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state") ?? "";

  if (!code) {
    return new Response("Missing code", { status: 400 });
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/link/linkedin/callback`;

    const tokenRes = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: process.env.AUTH_LINKEDIN_ID ?? "",
          client_secret: process.env.AUTH_LINKEDIN_SECRET ?? "",
        }),
      }
    );

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return new Response(`LinkedIn error: ${tokenData.error_description}`, {
        status: 400,
      });
    }

    // Récupérer le profil
    const userRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    await saveLinkedAccount(userId, "linkedin", {
      id: userData.sub,
      name: userData.name,
    });

    return new Response(
      "<html><body><script>window.opener.location.reload();window.close();</script></body></html>",
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("LinkedIn link error:", error);
    return new Response("Internal error", { status: 500 });
  }
}

async function saveLinkedAccount(
  userId: string,
  provider: string,
  data: { id: string; name: string }
) {
  const db = await getDb();
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
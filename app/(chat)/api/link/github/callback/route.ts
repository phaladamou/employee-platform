import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
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
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.AUTH_GITHUB_ID,
          client_secret: process.env.AUTH_GITHUB_SECRET,
          code,
        }),
      }
    );

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return new Response(`GitHub error: ${tokenData.error_description}`, {
        status: 400,
      });
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    await saveLinkedAccount(userId, "github", {
      id: String(userData.id),
      name: userData.login,
    });

    return new Response(
      "<html><body><script>window.opener.location.reload();window.close();</script></body></html>",
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("GitHub link error:", error);
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
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.AUTH_TWITTER_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/link/twitter/callback`;
  const state = session.user.id;
  const codeChallenge = "scientia-labs-link-challenge";

  const url = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=users.read%20tweet.read&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=plain&response_mode=query`;

  return NextResponse.redirect(url);
}

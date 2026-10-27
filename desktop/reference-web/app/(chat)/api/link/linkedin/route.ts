import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.AUTH_LINKEDIN_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/link/linkedin/callback`;
  const state = session.user.id;

  const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20profile%20email&state=${state}`;

  return NextResponse.redirect(url);
}

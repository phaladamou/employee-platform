// app/(chat)/api/github/connection/route.ts
// Consentement GitHub d'Atlas : le token (PAT colle par
// l'utilisateur) est verifie puis stocke chiffre. Le clair ne
// ressort JAMAIS de cette route (statut seul).
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  deleteConnector,
  getConnector,
  upsertConnector,
} from "@/lib/db/queries";
import {
  ATLAS_GITHUB_PROVIDER,
  ATLAS_GITHUB_SCOPE,
} from "@/lib/server/github-connection";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await getConnector({
      userId: session.user.id,
      provider: ATLAS_GITHUB_PROVIDER,
    });
    const row = rows[0];
    if (!row?.accessToken) {
      return NextResponse.json({ connected: false });
    }
    return NextResponse.json({
      connected: true,
      connectedAt: row.updatedAt ?? row.createdAt ?? null,
    });
  } catch (error) {
    console.error("GET /api/github/connection Error:", error);
    return NextResponse.json(
      { error: "Failed to read GitHub connection" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  // Verification en direct : le PAT doit authentifier /user.
  try {
    const probe = await fetch("https://api.github.com/user", {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "user-agent": "employee-atlas",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!probe.ok) {
      return NextResponse.json({ error: "invalid_token" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "verification_failed" }, { status: 502 });
  }
  // Import paresseux : sans cles OAUTH_*, le module crypto jette
  // au chargement — ici on repond 503 au lieu de casser la route.
  let encrypted: string;
  try {
    const { encryptToken } = await import("@/lib/connectors/core/crypto");
    encrypted = encryptToken(token);
  } catch {
    return NextResponse.json(
      { error: "encryption_unavailable" },
      { status: 503 }
    );
  }
  try {
    await upsertConnector({
      userId: session.user.id,
      provider: ATLAS_GITHUB_PROVIDER,
      accessToken: encrypted,
      scope: ATLAS_GITHUB_SCOPE,
    });
    return NextResponse.json({ connected: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/github/connection Error:", error);
    return NextResponse.json(
      { error: "Failed to save GitHub connection" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await deleteConnector({
      userId: session.user.id,
      provider: ATLAS_GITHUB_PROVIDER,
    });
    return NextResponse.json({ connected: false });
  } catch (error) {
    console.error("DELETE /api/github/connection Error:", error);
    return NextResponse.json(
      { error: "Failed to remove GitHub connection" },
      { status: 500 }
    );
  }
}

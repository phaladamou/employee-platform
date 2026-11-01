// app/(chat)/api/talents/[spec]/route.ts
//
// Edition d'une fiche riche : la base est la source de verite, cette
// route est l'unique ecriture (le migrate n'ecrase jamais ces cles).
// Patch partiel accepte : changer un mot = n'envoyer qu'un champ.
// Chaque ecriture est validee contre les outils noyau reels
// (colonne allowedTools de la fiche) : 400 explicite sinon.
// Note : le catalogue est global (partage entre les comptes) et aucun
// role admin n'existe encore : tout utilisateur connecte peut ecrire.
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  getHiredTalentSpecs,
  getTalentBySpec,
  requireAccountId,
  updateTalentRichProfile,
} from "@/lib/db/queries";
import {
  asStringList,
  formatTalentProfile,
} from "@/lib/employees/catalog";
import { validateRichProfileInput } from "@/lib/employees/rich-profiles";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ spec: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const { spec } = await params;
    const accountId = await requireAccountId(session.user.id);
    const talent = await getTalentBySpec(spec);
    if (!talent) {
      return NextResponse.json({ error: "Unknown talent" }, { status: 404 });
    }

    let patch;
    try {
      patch = validateRichProfileInput(
        asStringList(talent.allowedTools),
        body
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid profile" },
        { status: 400 }
      );
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "No updatable fields" },
        { status: 400 }
      );
    }

    const updated = await updateTalentRichProfile({ spec, patch });
    if (!updated) {
      return NextResponse.json({ error: "Unknown talent" }, { status: 404 });
    }
    const hired = await getHiredTalentSpecs(accountId);
    return NextResponse.json({
      talent: formatTalentProfile(updated, hired.includes(updated.spec)),
    });
  } catch (error) {
    console.error("PUT /api/talents/[spec] DB Error:", error);
    return NextResponse.json(
      { error: "Failed to update talent" },
      { status: 500 }
    );
  }
}

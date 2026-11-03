// app/(chat)/api/employees/[id]/chat/route.ts
// Socle discussion Engineering : reponse deterministe + creation
// de mission optionnelle (le temps reel et le LLM viendront ensuite).
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  createMission,
  getEmployeeById,
  requireAccountId,
} from "@/lib/db/queries";
import { isMissionStatus } from "@/lib/employees/catalog";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing employee" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const asMission = body.asMission === true;
  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  try {
    const accountId = await requireAccountId(session.user.id);
    const target = await getEmployeeById(accountId, id);
    if (!target || target.status === "terminated") {
      return NextResponse.json({ error: "Unknown employee" }, { status: 404 });
    }

    if (!asMission) {
      return NextResponse.json({
        reply: `Bien reçu. Je suis ${target.name} (${target.role}). Décrivez la mission puis cochez "Mission" pour me la confier ; je l'exécuterai dans mon workspace.`,
      });
    }

    const [created] = await createMission({
      accountId,
      employeeId: id,
      title: message.slice(0, 80),
      prompt: message,
    });
    if (!created) {
      throw new Error("insert returned no row");
    }
    return NextResponse.json(
      {
        reply: `Mission enregistrée pour ${target.name} : "${message.slice(0, 120)}". Je la traite dans mon workspace.`,
        mission: {
          id: created.id,
          title: created.title,
          status: isMissionStatus(created.status) ? created.status : "queued",
          employeeId: created.employeeId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/employees/[id]/chat Error:", error);
    return NextResponse.json(
      { error: "Failed to chat with employee" },
      { status: 500 }
    );
  }
}

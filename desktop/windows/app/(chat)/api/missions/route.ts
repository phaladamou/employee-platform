// app/(chat)/api/missions/route.ts
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { getDb } from "@/lib/db/client";
import {
  createMission,
  getEmployeeById,
  getRecentMissionsByAccount,
  requireAccountId,
} from "@/lib/db/queries";
import { employee } from "@/lib/db/schema";
import { isMissionStatus } from "@/lib/employees/catalog";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accountId = await requireAccountId(session.user.id);
    const rows = await getRecentMissionsByAccount(accountId);
    return NextResponse.json({
      missions: rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: isMissionStatus(row.status) ? row.status : "queued",
        report: row.report,
        updatedAt: row.updatedAt.toISOString(),
        employeeId: row.employeeId,
        employeeName: row.employeeName,
      })),
    });
  } catch (error) {
    console.error("GET /api/missions DB Error:", error);
    return NextResponse.json(
      { error: "Failed to load missions" },
      { status: 500 }
    );
  }
}

// Soumet une mission a un employe du compte (socle Engineering + CLI).
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

  const employeeId =
    typeof body.employeeId === "string" ? body.employeeId.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 120)
      : prompt.slice(0, 80) || "Mission";
  const expectFile =
    typeof body.expectFile === "string" && body.expectFile.trim()
      ? body.expectFile.trim()
      : undefined;
  const expectTest = body.expectTest === true;

  if (!employeeId || !prompt) {
    return NextResponse.json(
      { error: "Missing employeeId or prompt" },
      { status: 400 }
    );
  }

  try {
    const accountId = await requireAccountId(session.user.id);
    const target = await getEmployeeById(accountId, employeeId);
    if (!target || target.status === "terminated") {
      return NextResponse.json({ error: "Unknown employee" }, { status: 404 });
    }

    const [created] = await createMission({
      accountId,
      employeeId,
      title,
      prompt,
      expectFile,
      expectTest,
    });
    if (!created) {
      throw new Error("insert returned no row");
    }

    // La mission passe l'employe en travail (visible dans la grille).
    try {
      const db = await getDb();
      await db
        .update(employee)
        .set({ status: "working", currentTask: title })
        .where(eq(employee.id, employeeId));
    } catch {
      // La mission est creee : le statut reste un confort d'affichage.
    }

    return NextResponse.json(
      {
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
    console.error("POST /api/missions DB Error:", error);
    return NextResponse.json(
      { error: "Failed to submit mission" },
      { status: 500 }
    );
  }
}

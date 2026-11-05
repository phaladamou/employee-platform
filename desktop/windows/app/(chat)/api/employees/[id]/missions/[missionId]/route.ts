// app/(chat)/api/employees/[id]/missions/[missionId]/route.ts
// Detail d'une mission (rapport complet + trace des outils).
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  getEmployeeById,
  getMissionById,
  requireAccountId,
} from "@/lib/db/queries";
import { toToolCallRecords } from "@/lib/server/employee-conversation-mapping";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; missionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, missionId } = await params;
  if (!id || !missionId) {
    return NextResponse.json({ error: "Missing mission" }, { status: 400 });
  }
  try {
    const accountId = await requireAccountId(session.user.id);
    const target = await getEmployeeById(accountId, id);
    if (!target || target.status === "terminated") {
      return NextResponse.json({ error: "Unknown employee" }, { status: 404 });
    }
    const row = await getMissionById(accountId, missionId);
    if (!row || row.employeeId !== id) {
      return NextResponse.json({ error: "Unknown mission" }, { status: 404 });
    }
    return NextResponse.json({
      mission: {
        id: row.id,
        title: row.title,
        prompt: row.prompt,
        status: row.status,
        report: row.report,
        toolCalls: toToolCallRecords(row.toolCalls),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/employees/[id]/missions/[missionId] Error:", error);
    return NextResponse.json(
      { error: "Failed to load mission" },
      { status: 500 }
    );
  }
}

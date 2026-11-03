// app/(chat)/api/employees/[id]/missions/route.ts
// Historique des missions d'un employe (onglet History).
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  getEmployeeById,
  getMissionsByEmployee,
  requireAccountId,
} from "@/lib/db/queries";
import { toToolCallRecords } from "@/lib/server/employee-conversation-mapping";

export async function GET(
  _request: Request,
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
  try {
    const accountId = await requireAccountId(session.user.id);
    const target = await getEmployeeById(accountId, id);
    if (!target || target.status === "terminated") {
      return NextResponse.json({ error: "Unknown employee" }, { status: 404 });
    }
    const rows = await getMissionsByEmployee(accountId, id);
    return NextResponse.json({
      missions: rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        toolCalls: toToolCallRecords(row.toolCalls),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/employees/[id]/missions Error:", error);
    return NextResponse.json(
      { error: "Failed to load employee missions" },
      { status: 500 }
    );
  }
}

// app/(chat)/api/missions/route.ts
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  getRecentMissionsByAccount,
  requireAccountId,
} from "@/lib/db/queries";
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

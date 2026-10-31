// app/(chat)/api/employees/route.ts
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  getDepartments,
  getEmployeesByAccount,
  requireAccountId,
} from "@/lib/db/queries";
import {
  asStringList,
  isEmployeeKind,
  isEmployeeStatus,
  type Employee,
} from "@/lib/employees/catalog";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accountId = await requireAccountId(session.user.id);
    const [departments, rows] = await Promise.all([
      getDepartments(),
      getEmployeesByAccount(accountId),
    ]);
    const employees: Employee[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      status: isEmployeeStatus(row.status) ? row.status : "idle",
      departmentId: row.departmentId,
      ...(row.currentTask ? { currentTask: row.currentTask } : {}),
      ...(isEmployeeKind(row.kind) ? { kind: row.kind } : {}),
      ...(row.background ? { background: row.background } : {}),
      technologies: asStringList(row.technologies),
      hiredAt: row.hiredAt.toISOString(),
      ...(row.talentSpec ? { talentSpec: row.talentSpec } : {}),
      ...(row.specVersion ? { specVersion: row.specVersion } : {}),
      ...(row.createdBy ? { createdBy: row.createdBy } : {}),
    }));
    return NextResponse.json({
      departments: departments.map((d) => d.id),
      employees,
    });
  } catch (error) {
    console.error("GET /api/employees DB Error:", error);
    return NextResponse.json(
      { error: "Failed to load employees" },
      { status: 500 }
    );
  }
}

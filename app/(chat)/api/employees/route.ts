// app/(chat)/api/employees/route.ts
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { getDepartments, getEmployees } from "@/lib/db/queries";
import { isEmployeeStatus, type Employee } from "@/lib/employees/catalog";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [departments, rows] = await Promise.all([
      getDepartments(),
      getEmployees(),
    ]);
    const employees: Employee[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      status: isEmployeeStatus(row.status) ? row.status : "idle",
      departmentId: row.departmentId,
      ...(row.currentTask ? { currentTask: row.currentTask } : {}),
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

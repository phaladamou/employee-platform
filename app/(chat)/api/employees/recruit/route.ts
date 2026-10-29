// app/(chat)/api/employees/recruit/route.ts
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { createEmployee, getDepartments } from "@/lib/db/queries";
import {
  AVAILABLE_AGENTS,
  isEmployeeStatus,
  type Employee,
} from "@/lib/employees/catalog";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { agentId, departmentId } = body;
  const agent = AVAILABLE_AGENTS.find((a) => a.id === agentId);
  if (!agent) {
    return NextResponse.json({ error: "Unknown agent" }, { status: 400 });
  }
  if (typeof departmentId !== "string" || !departmentId) {
    return NextResponse.json(
      { error: "Missing department" },
      { status: 400 }
    );
  }

  try {
    const departments = await getDepartments();
    if (!departments.some((d) => d.id === departmentId)) {
      return NextResponse.json(
        { error: "Unknown department" },
        { status: 400 }
      );
    }
    const [created] = await createEmployee({
      name: agent.name,
      role: agent.role,
      departmentId,
    });
    if (!created) {
      throw new Error("insert returned no row");
    }
    const employee: Employee = {
      id: created.id,
      name: created.name,
      role: created.role,
      status: isEmployeeStatus(created.status) ? created.status : "idle",
      departmentId: created.departmentId,
    };
    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    console.error("POST /api/employees/recruit DB Error:", error);
    return NextResponse.json(
      { error: "Failed to recruit employee" },
      { status: 500 }
    );
  }
}

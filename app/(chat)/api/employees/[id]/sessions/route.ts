// app/(chat)/api/employees/[id]/sessions/route.ts
// Sessions de discussion d'un employe (multi-conversations).
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  createEmployeeSession,
  getEmployeeById,
  getEmployeeSessions,
  requireAccountId,
} from "@/lib/db/queries";

async function resolveTarget(userId: string, employeeId: string) {
  const accountId = await requireAccountId(userId);
  const target = await getEmployeeById(accountId, employeeId);
  if (!target || target.status === "terminated") {
    return null;
  }
  return target;
}

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
    const target = await resolveTarget(session.user.id, id);
    if (!target) {
      return NextResponse.json({ error: "Unknown employee" }, { status: 404 });
    }
    const rows = await getEmployeeSessions(session.user.id, id);
    return NextResponse.json({
      sessions: rows.map((row) => ({
        id: row.id,
        title: row.title,
        preview: row.preview,
        createdAt: row.createdAt.toISOString(),
        lastActiveAt: row.lastActiveAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/employees/[id]/sessions Error:", error);
    return NextResponse.json(
      { error: "Failed to load employee sessions" },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const target = await resolveTarget(session.user.id, id);
    if (!target) {
      return NextResponse.json({ error: "Unknown employee" }, { status: 404 });
    }
    const created = await createEmployeeSession({
      userId: session.user.id,
      employeeId: id,
    });
    return NextResponse.json({ session: { id: created.id } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/employees/[id]/sessions Error:", error);
    return NextResponse.json(
      { error: "Failed to create employee session" },
      { status: 500 }
    );
  }
}

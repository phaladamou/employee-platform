// app/(chat)/api/employees/[id]/files/route.ts
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { getEmployeeById, requireAccountId } from "@/lib/db/queries";
import { listWorkspaceFiles } from "@/lib/engineering/workspace-store";

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
    if (!target) {
      return NextResponse.json({ error: "Unknown employee" }, { status: 404 });
    }
    const files = await listWorkspaceFiles(id);
    return NextResponse.json({ files });
  } catch (error) {
    console.error("GET /api/employees/[id]/files Error:", error);
    return NextResponse.json(
      { error: "Failed to list workspace files" },
      { status: 500 }
    );
  }
}

// app/(chat)/api/employees/[id]/files/[...path]/route.ts
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { getEmployeeById, requireAccountId } from "@/lib/db/queries";
import { isSafeWorkspacePath } from "@/lib/engineering/files";
import { readWorkspaceFile } from "@/lib/engineering/workspace-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, path } = await params;
  const relPath = (path ?? []).join("/");
  if (!id || !relPath || !isSafeWorkspacePath(relPath)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const accountId = await requireAccountId(session.user.id);
    const target = await getEmployeeById(accountId, id);
    if (!target) {
      return NextResponse.json({ error: "Unknown employee" }, { status: 404 });
    }
    const file = await readWorkspaceFile(id, relPath);
    if (!file) {
      return NextResponse.json({ error: "Unreadable file" }, { status: 404 });
    }
    return NextResponse.json({ path: relPath, ...file });
  } catch (error) {
    console.error("GET /api/employees/[id]/files/[...path] Error:", error);
    return NextResponse.json(
      { error: "Failed to read workspace file" },
      { status: 500 }
    );
  }
}

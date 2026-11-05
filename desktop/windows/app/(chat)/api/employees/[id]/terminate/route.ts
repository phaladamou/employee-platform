// app/(chat)/api/employees/[id]/terminate/route.ts
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  requireAccountId,
  terminateEmployeeByAccount,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing employee" }, { status: 400 });
    }
    const accountId = await requireAccountId(session.user.id);
    const terminated = await terminateEmployeeByAccount(accountId, id);
    if (!terminated) {
      return NextResponse.json({ error: "Unknown employee" }, { status: 404 });
    }
    return NextResponse.json({
      id: terminated.id,
      status: terminated.status,
      terminatedAt: terminated.terminatedAt?.toISOString() ?? null,
    });
  } catch (error) {
    if (
      error instanceof ChatbotError &&
      error.cause === "Cannot terminate the Chef"
    ) {
      return NextResponse.json(
        { error: "Cannot terminate the Chef" },
        { status: 400 }
      );
    }
    console.error("POST /api/employees/[id]/terminate DB Error:", error);
    return NextResponse.json(
      { error: "Failed to terminate employee" },
      { status: 500 }
    );
  }
}

// app/(chat)/api/employees/[id]/release/route.ts
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  releaseEmployeeByAccount,
  requireAccountId,
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
    const released = await releaseEmployeeByAccount(accountId, id);
    if (!released) {
      return NextResponse.json({ error: "Unknown employee" }, { status: 404 });
    }
    return NextResponse.json({
      id: released.id,
      status: released.status,
      releasedAt: released.releasedAt?.toISOString() ?? null,
    });
  } catch (error) {
    if (
      error instanceof ChatbotError &&
      error.cause === "Cannot release the Chef"
    ) {
      return NextResponse.json(
        { error: "Cannot release the Chef" },
        { status: 400 }
      );
    }
    console.error("POST /api/employees/[id]/release DB Error:", error);
    return NextResponse.json(
      { error: "Failed to release employee" },
      { status: 500 }
    );
  }
}

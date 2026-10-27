// app/(chat)/api/artefacts/workspace/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getChatIdByDocumentId } from "@/lib/db/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("id");

  if (!documentId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await getChatIdByDocumentId({ documentId, userId: session.user.id });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/artefacts/chat error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
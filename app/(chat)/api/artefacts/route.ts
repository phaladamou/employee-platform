// app/(chat)/api/artefacts/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getDocumentsByUserId } from "@/lib/db/queries";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const documents = await getDocumentsByUserId({ userId: session.user.id });
    return NextResponse.json({ documents });
  } catch (error) {
    console.error("GET /api/artefacts error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
// app/simulations/api/category/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getUserCategory, setUserCategory } from "@/lib/simulations/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const category = await getUserCategory(session.user.id);
  return NextResponse.json({ category: category?.category ?? null });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { category } = await request.json();
  await setUserCategory(session.user.id, category);
  return NextResponse.json({ success: true });
}

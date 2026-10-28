import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { file } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const db = await getDb();

  const [result] = await db.select().from(file).where(eq(file.id, id));

  if (!result) {
    return new Response("Not found", { status: 404 });
  }

  const buffer = Buffer.from(result.data, "base64");

  return new Response(buffer, {
    headers: {
      "Content-Type": result.type,
      "Content-Disposition": `inline; filename="${result.name}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
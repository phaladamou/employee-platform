import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { file } from "@/lib/db/schema";

const client = postgres(process.env.POSTGRES_URL ?? "", {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});
const db = drizzle(client);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
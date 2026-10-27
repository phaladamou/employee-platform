import { NextResponse } from "next/server";
import { z } from "zod";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { auth } from "@/app/(auth)/auth";
import { file } from "@/lib/db/schema";

const client = postgres(process.env.POSTGRES_URL ?? "", {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});
const db = drizzle(client);

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "text/plain",
  "application/json",
  "text/x-python",
  "application/x-python",
  "text/javascript",
  "application/javascript",
  "text/markdown",
  "application/xml",
  "text/xml",
  "application/zip",
  "application/gzip",
  "application/x-rar-compressed",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: "File size should be less than 10MB",
    })
    .refine((file) => ALLOWED_TYPES.includes(file.type), {
      message:
        "File type not supported. Allowed: PDF, Word, CSV, TXT, JSON, Python, JS, Markdown, XML, ZIP",
    }),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const f = formData.get("file") as File;

    if (!f) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validated = FileSchema.safeParse({ file: f });

    if (!validated.success) {
      const errorMessage = validated.error.errors
        .map((e) => e.message)
        .join(", ");
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const buffer = Buffer.from(await f.arrayBuffer());
    const base64 = buffer.toString("base64");

    const [saved] = await db
      .insert(file)
      .values({
        userId: session.user.id,
        name: f.name,
        type: f.type,
        size: String(f.size),
        data: base64,
      })
      .returning({ id: file.id });

    const url = `/api/files/${saved.id}`;

    return NextResponse.json({
      url,
      pathname: f.name,
      contentType: f.type,
    });
  } catch (_error) {
    console.error("Upload error:", _error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
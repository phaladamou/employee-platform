// app/(chat)/api/desktop/settings/route.ts
//
// Lecture/ecriture des reglages locaux (application bureau uniquement).
// Les secrets ne sont jamais renvoyes en clair (version masquee).
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { loadDesktopSettings, saveDesktopSettings } from "@/lib/desktop/settings";

const MAX_LEN = 500;
const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";

function mask(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value.length <= 8) {
    return "••••";
  }
  return `${value.slice(0, 3)}••••${value.slice(-4)}`;
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, MAX_LEN);
}

export async function GET() {
  if (process.env.DESKTOP !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = loadDesktopSettings();
  const llmApiKey = settings.llmApiKey ?? process.env.DEEPSEEK_API_KEY;

  return NextResponse.json({
    configured: Boolean(llmApiKey),
    llmApiKey: mask(llmApiKey),
    llmBaseUrl:
      settings.llmBaseUrl ?? process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL,
    tavilyApiKey: mask(settings.tavilyApiKey ?? process.env.TAVILY_API_KEY),
  });
}

export async function POST(request: Request) {
  if (process.env.DESKTOP !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const llmBaseUrl = cleanString(body.llmBaseUrl);
  if (llmBaseUrl && !/^https?:\/\/.+/.test(llmBaseUrl)) {
    return NextResponse.json(
      { error: "Base URL must start with http(s)://" },
      { status: 400 }
    );
  }

  saveDesktopSettings({
    llmApiKey: cleanString(body.llmApiKey),
    llmBaseUrl,
    tavilyApiKey: cleanString(body.tavilyApiKey),
  });

  return NextResponse.json({ ok: true });
}

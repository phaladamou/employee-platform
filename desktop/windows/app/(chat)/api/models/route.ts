// app/(chat)/api/models/route.ts
import { chatModels, type ModelCapabilities } from "@/lib/ai/models";

const defaultCapabilities: ModelCapabilities = {
  tools: true,
  vision: false,
  reasoning: false,
};

export async function GET() {
  const headers = {
    "Cache-Control": "public, max-age=86400, s-maxage=86400",
  };

  const capabilities = Object.fromEntries(
    chatModels.map((m) => [m.id, defaultCapabilities])
  );

  return Response.json(capabilities, { headers });
}

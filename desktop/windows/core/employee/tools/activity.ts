import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { toolRoot, type ToolContext } from "./tool";

/** Journal d'activite JSONL a la racine du workspace (lu par l'IDE web). */
export const ACTIVITY_LOG_FILE = ".employee-activity.log";

export async function appendActivity(
  ctx: ToolContext,
  tool: string,
  message: string,
  ok: boolean
): Promise<void> {
  try {
    const root = toolRoot(ctx);
    await mkdir(root, { recursive: true });
    const line = `${JSON.stringify({ ts: new Date().toISOString(), tool, message, ok })}\n`;
    await appendFile(join(root, ACTIVITY_LOG_FILE), line, "utf8");
  } catch {
    // Telemetrie best-effort : un journal inaccessible ne doit jamais
    // faire echouer la mission.
  }
}

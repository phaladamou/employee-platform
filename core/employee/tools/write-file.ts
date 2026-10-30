import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  resolveWithinRoot,
  toolFail,
  toolOk,
  type EmployeeTool,
  type ToolArgs,
  type ToolContext,
} from "./tool";

export const WRITE_FILE_MAX_CHARS = 500_000;

export function createWriteFileTool(): EmployeeTool {
  return {
    name: "write_file",
    description:
      "Write UTF-8 text to a workspace file (created with its parent " +
      "directories, overwritten if it exists).",
    argsDescription: '{ "path": "<relative file path>", "content": "<text>" }',
    async execute(
      args: ToolArgs,
      ctx: ToolContext
    ): Promise<{ ok: boolean; output: string }> {
      if (typeof args.path !== "string" || args.path.length === 0) {
        return toolFail('write_file requires a "path" string argument');
      }
      if (typeof args.content !== "string") {
        return toolFail('write_file requires a "content" string argument');
      }
      if (args.content.length > WRITE_FILE_MAX_CHARS) {
        return toolFail(
          `content too large (${args.content.length} chars, max ${WRITE_FILE_MAX_CHARS})`
        );
      }

      let resolved: string;

      try {
        resolved = await resolveWithinRoot(ctx.sandboxRoot, args.path);
      } catch {
        return toolFail(`path escapes the workspace: ${args.path}`);
      }

      await mkdir(dirname(resolved), { recursive: true });
      await writeFile(resolved, args.content, "utf8");

      return toolOk(
        `wrote ${Buffer.byteLength(args.content, "utf8")} bytes to ${args.path}`
      );
    },
  };
}

import { readFile, stat } from "node:fs/promises";

import {
  resolveWithinRoot,
  toolFail,
  toolOk,
  toolRoot,
  type EmployeeTool,
  type ToolArgs,
  type ToolContext,
} from "./tool";

export const READ_FILE_MAX_BYTES = 200_000;

export function createReadFileTool(): EmployeeTool {
  return {
    name: "read_file",
    description:
      "Read a UTF-8 text file from the workspace and return its content.",
    argsDescription: '{ "path": "<relative file path>" }',
    async execute(
      args: ToolArgs,
      ctx: ToolContext
    ): Promise<{ ok: boolean; output: string }> {
      if (typeof args.path !== "string" || args.path.length === 0) {
        return toolFail('read_file requires a "path" string argument');
      }

      let resolved: string;

      try {
        resolved = await resolveWithinRoot(toolRoot(ctx), args.path);
      } catch {
        return toolFail(`path escapes the workspace: ${args.path}`);
      }

      try {
        const info = await stat(resolved);

        if (!info.isFile()) {
          return toolFail(`not a file: ${args.path}`);
        }
        if (info.size > READ_FILE_MAX_BYTES) {
          return toolFail(
            `file too large (${info.size} bytes, max ${READ_FILE_MAX_BYTES})`
          );
        }

        return toolOk(await readFile(resolved, "utf8"));
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: unknown }).code === "ENOENT"
        ) {
          return toolFail(`file not found: ${args.path}`);
        }

        throw error;
      }
    },
  };
}

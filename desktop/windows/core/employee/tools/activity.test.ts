import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ACTIVITY_LOG_FILE, appendActivity } from "./activity";
import type { ToolContext } from "./tool";

describe("activity log", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  it("appends JSONL lines with tool, message and status", async () => {
    dir = await mkdtemp(join(tmpdir(), "emp-activity-"));
    const ctx: ToolContext = { sandboxRoot: dir };

    await appendActivity(ctx, "read_file", "Reading notes.txt...", true);
    await appendActivity(ctx, "github_push", "Push failed: nope", false);

    const content = await readFile(join(dir, ACTIVITY_LOG_FILE), "utf8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({
      tool: "read_file",
      message: "Reading notes.txt...",
      ok: true,
    });
    expect(JSON.parse(lines[1]).ok).toBe(false);
    expect(typeof JSON.parse(lines[0]).ts).toBe("string");
  });
});

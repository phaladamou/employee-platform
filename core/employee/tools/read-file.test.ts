import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createReadFileTool } from "./read-file";
import type { ToolContext } from "./tool";

describe("read_file tool", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function sandbox(): Promise<ToolContext> {
    dir = await mkdtemp(join(tmpdir(), "emp-read-"));
    return { sandboxRoot: dir };
  }

  it("reads a workspace file", async () => {
    const ctx = await sandbox();
    await writeFile(join(dir, "notes.txt"), "hello", "utf8");

    const result = await createReadFileTool().execute(
      { path: "notes.txt" },
      ctx
    );

    expect(result.ok).toBe(true);
    expect(result.output).toBe("hello");
  });

  it("fails on missing files and directories", async () => {
    const ctx = await sandbox();
    await mkdir(join(dir, "sub"));

    const tool = createReadFileTool();

    const missing = await tool.execute({ path: "nope.txt" }, ctx);
    expect(missing.ok).toBe(false);
    expect(missing.output).toContain("not found");

    const notFile = await tool.execute({ path: "sub" }, ctx);
    expect(notFile.ok).toBe(false);
    expect(notFile.output).toContain("not a file");
  });

  it("refuses paths outside the workspace", async () => {
    const ctx = await sandbox();
    const tool = createReadFileTool();

    for (const path of ["../escape.txt", "/etc/hostname", ".."]) {
      const result = await tool.execute({ path }, ctx);
      expect(result.ok).toBe(false);
      expect(result.output).toContain("escapes");
    }
  });

  it("requires a path string", async () => {
    const ctx = await sandbox();

    const result = await createReadFileTool().execute({}, ctx);

    expect(result.ok).toBe(false);
    expect(result.output).toContain('"path"');
  });

  it("refuses reads through symlinks pointing outside", async () => {
    const ctx = await sandbox();
    const outside = await mkdtemp(join(tmpdir(), "emp-out-"));

    try {
      await writeFile(join(outside, "secret.txt"), "OUTSIDE", "utf8");
      await symlink(join(outside, "secret.txt"), join(dir, "link.txt"));

      const result = await createReadFileTool().execute(
        { path: "link.txt" },
        ctx
      );

      expect(result.ok).toBe(false);
      expect(result.output).toContain("escapes");
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

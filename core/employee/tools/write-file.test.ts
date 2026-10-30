import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { WRITE_FILE_MAX_CHARS, createWriteFileTool } from "./write-file";
import type { ToolContext } from "./tool";

describe("write_file tool", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function sandbox(): Promise<ToolContext> {
    dir = await mkdtemp(join(tmpdir(), "emp-write-"));
    return { sandboxRoot: dir };
  }

  it("writes a file, creating parent directories", async () => {
    const ctx = await sandbox();

    const result = await createWriteFileTool().execute(
      { path: "docs/notes.txt", content: "hello" },
      ctx
    );

    expect(result.ok).toBe(true);
    expect(result.output).toContain("5 bytes");
    await expect(
      readFile(join(dir, "docs", "notes.txt"), "utf8")
    ).resolves.toBe("hello");
  });

  it("overwrites existing files", async () => {
    const ctx = await sandbox();
    const tool = createWriteFileTool();

    await tool.execute({ path: "a.txt", content: "one" }, ctx);
    const result = await tool.execute({ path: "a.txt", content: "two" }, ctx);

    expect(result.ok).toBe(true);
    await expect(readFile(join(dir, "a.txt"), "utf8")).resolves.toBe("two");
  });

  it("refuses paths outside the workspace", async () => {
    const ctx = await sandbox();

    const result = await createWriteFileTool().execute(
      { path: "../escape.txt", content: "x" },
      ctx
    );

    expect(result.ok).toBe(false);
    expect(result.output).toContain("escapes");
  });

  it("validates arguments and size", async () => {
    const ctx = await sandbox();
    const tool = createWriteFileTool();

    const noPath = await tool.execute({ content: "x" }, ctx);
    expect(noPath.ok).toBe(false);

    const noContent = await tool.execute({ path: "a.txt" }, ctx);
    expect(noContent.ok).toBe(false);

    const tooBig = await tool.execute(
      { path: "big.txt", content: "x".repeat(WRITE_FILE_MAX_CHARS + 1) },
      ctx
    );
    expect(tooBig.ok).toBe(false);
    expect(tooBig.output).toContain("too large");
  });

  it("refuses writes through symlinks pointing outside", async () => {
    const ctx = await sandbox();
    const outside = await mkdtemp(join(tmpdir(), "emp-out-"));

    try {
      await symlink(outside, join(dir, "wdir"));

      const result = await createWriteFileTool().execute(
        { path: "wdir/evil.txt", content: "x" },
        ctx
      );

      expect(result.ok).toBe(false);
      expect(result.output).toContain("escapes");
      await expect(
        readFile(join(outside, "evil.txt"), "utf8")
      ).rejects.toThrow();
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

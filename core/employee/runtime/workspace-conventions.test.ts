import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  WORKSPACE_CONVENTIONS_MAX_CHARS,
  loadWorkspaceConventions,
} from "./workspace-conventions";

describe("loadWorkspaceConventions", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function sandbox(): Promise<string> {
    dir = await mkdtemp(join(tmpdir(), "emp-conv-"));
    return dir;
  }

  it("reads AGENTS.md when present", async () => {
    const root = await sandbox();
    await writeFile(join(root, "AGENTS.md"), "Always reply in French.\n", "utf8");

    await expect(loadWorkspaceConventions(root)).resolves.toBe(
      "Always reply in French."
    );
  });

  it("falls back to CONVENTIONS.md", async () => {
    const root = await sandbox();
    await writeFile(join(root, "CONVENTIONS.md"), "Use tabs.\n", "utf8");

    await expect(loadWorkspaceConventions(root)).resolves.toBe("Use tabs.");
  });

  it("prefers AGENTS.md over CONVENTIONS.md", async () => {
    const root = await sandbox();
    await writeFile(join(root, "AGENTS.md"), "Agents rule.\n", "utf8");
    await writeFile(join(root, "CONVENTIONS.md"), "Legacy rule.\n", "utf8");

    await expect(loadWorkspaceConventions(root)).resolves.toBe("Agents rule.");
  });

  it("returns null when no conventions file exists", async () => {
    const root = await sandbox();

    await expect(loadWorkspaceConventions(root)).resolves.toBeNull();
  });

  it("returns null for empty files and caps length", async () => {
    const root = await sandbox();
    await writeFile(join(root, "AGENTS.md"), "   \n", "utf8");

    await expect(loadWorkspaceConventions(root)).resolves.toBeNull();

    await writeFile(
      join(root, "AGENTS.md"),
      `x${"y".repeat(WORKSPACE_CONVENTIONS_MAX_CHARS + 100)}`,
      "utf8"
    );
    const loaded = await loadWorkspaceConventions(root);
    expect(loaded?.length).toBe(WORKSPACE_CONVENTIONS_MAX_CHARS);
    expect(loaded?.startsWith("x")).toBe(true);
  });
});

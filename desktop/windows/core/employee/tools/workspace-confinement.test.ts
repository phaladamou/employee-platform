import {
  chmod,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { EmployeeWorkspaces } from "../workspaces/employee-workspaces";
import { createReadFileTool } from "./read-file";
import { createRunShellTool } from "./run-shell";
import { toolRoot, type ToolContext } from "./tool";
import { createWriteFileTool } from "./write-file";

// Binaire Node resolu sans PATH (l'env n'est jamais herite).
const NODE = JSON.stringify(process.execPath);

describe("workspace confinement", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function world(): Promise<{
    ctx: ToolContext;
    empA: string;
    empB: string;
  }> {
    dir = await mkdtemp(join(tmpdir(), "emp-confine-"));
    const workspaces = new EmployeeWorkspaces({
      directory: join(dir, "workspaces"),
    });
    const empA = await workspaces.acquire("emp_a");
    const empB = await workspaces.acquire("emp_b");
    await writeFile(join(empB, "secret.txt"), "TOP-SECRET");
    return { ctx: { sandboxRoot: join(dir, "sandbox"), workspaceRoot: empA }, empA, empB };
  }

  describe("toolRoot", () => {
    it("prefers the dedicated workspace over the shared sandbox", () => {
      expect(toolRoot({ sandboxRoot: "/shared", workspaceRoot: "/ws/emp_1" })).toBe(
        "/ws/emp_1"
      );
    });

    it("falls back to the shared sandbox without a workspace", () => {
      expect(toolRoot({ sandboxRoot: "/shared" })).toBe("/shared");
    });
  });

  describe("write_file", () => {
    it("writes nested files inside the workspace", async () => {
      const { ctx, empA } = await world();

      const result = await createWriteFileTool().execute(
        { path: "docs/note.txt", content: "bonjour" },
        ctx
      );

      expect(result.ok).toBe(true);
      expect(await readFile(join(empA, "docs", "note.txt"), "utf8")).toBe("bonjour");
    });

    it("refuses writes escaping into a sibling employee", async () => {
      const { ctx, empB } = await world();
      const target = join(empB, "evil.txt");

      const result = await createWriteFileTool().execute(
        { path: "../emp_b/evil.txt", content: "pwned" },
        ctx
      );

      expect(result.ok).toBe(false);
      expect(result.output).toContain("escapes the workspace");
      await expect(stat(target)).rejects.toThrow();
    });

    it("refuses absolute paths outside the workspace", async () => {
      const { ctx } = await world();
      const outside = join(dir, "outside.txt");

      const result = await createWriteFileTool().execute(
        { path: outside, content: "pwned" },
        ctx
      );

      expect(result.ok).toBe(false);
      expect(result.output).toContain("escapes the workspace");
      await expect(stat(outside)).rejects.toThrow();
    });
  });

  describe("read_file", () => {
    it("reads files inside the workspace", async () => {
      const { ctx, empA } = await world();
      await writeFile(join(empA, "note.txt"), "bonjour");

      const result = await createReadFileTool().execute({ path: "note.txt" }, ctx);

      expect(result.ok).toBe(true);
      expect(result.output).toBe("bonjour");
    });

    it("refuses cross-employee reads without leaking content", async () => {
      const { ctx } = await world();

      const result = await createReadFileTool().execute(
        { path: "../emp_b/secret.txt" },
        ctx
      );

      expect(result.ok).toBe(false);
      expect(result.output).toContain("escapes the workspace");
      expect(result.output).not.toContain("TOP-SECRET");
    });

    it("refuses absolute paths outside the workspace", async () => {
      const { ctx, empB } = await world();

      const result = await createReadFileTool().execute(
        { path: join(empB, "secret.txt") },
        ctx
      );

      expect(result.ok).toBe(false);
      expect(result.output).toContain("escapes the workspace");
      expect(result.output).not.toContain("TOP-SECRET");
    });
  });

  describe("run_shell", () => {
    it("runs with the workspace as working directory", async () => {
      const { ctx, empA } = await world();

      const result = await createRunShellTool().execute(
        { command: `${NODE} -e "process.stdout.write(process.cwd())"` },
        ctx
      );

      expect(result.ok).toBe(true);
      expect(await realpath(result.output)).toBe(await realpath(empA));
    });

    it("writes relative files inside the workspace", async () => {
      const { ctx, empA } = await world();

      const result = await createRunShellTool().execute(
        { command: "echo hi > note.txt" },
        ctx
      );

      expect(result.ok).toBe(true);
      expect(await readFile(join(empA, "note.txt"), "utf8")).toContain("hi");
    });

    it("hands the workspace (not the sandbox) to emp-sandbox", async () => {
      const { ctx, empA } = await world();
      const seenArgs = join(dir, "seen-args.txt");
      const bin = join(dir, "fake-sandbox.sh");
      await writeFile(
        bin,
        `#!/bin/sh\necho "$@" > ${JSON.stringify(seenArgs)}\n` +
          `printf '%s' '{"exit_code":0,"stdout":"ok","stderr":"","timed_out":false,"output_truncated":false}'\n`
      );
      await chmod(bin, 0o755);

      const result = await createRunShellTool().execute(
        { command: "echo ignored" },
        { ...ctx, sandboxBin: bin }
      );

      expect(result.ok).toBe(true);
      const argv = await readFile(seenArgs, "utf8");
      expect(argv).toContain(`--work-dir ${empA}`);
      expect(argv).not.toContain(`--work-dir ${ctx.sandboxRoot}`);
    });

    it("blocks shell escapes through the real emp-sandbox", async () => {
      // Preuve bout-en-bout TypeScript -> binaire -> Landlock. Linux
      // seul (pas de Landlock ailleurs) ; skip bruyant, jamais
      // silencieux — meme convention que la suite cargo.
      if (process.platform !== "linux") {
        console.log("SKIP shell-escape full chain: Landlock needs Linux");
        return;
      }
      const { ctx } = await world();
      const bin = join(
        fileURLToPath(new URL("../../..", import.meta.url)),
        "rust",
        "target",
        "debug",
        "emp-sandbox"
      );
      await stat(bin).catch(() => {
        throw new Error(
          "emp-sandbox not built: run `cargo build` in rust/ before the suite (the gates do it)"
        );
      });

      const result = await createRunShellTool().execute(
        { command: "cat ../emp_b/secret.txt" },
        { ...ctx, sandboxBin: bin }
      );

      if (result.output.includes("landlock not supported")) {
        console.log(`SKIP shell-escape full chain: ${result.output}`);
        return;
      }
      expect(result.ok).toBe(false);
      expect(result.output).toContain("exit code");
      expect(result.output).not.toContain("TOP-SECRET");
    });
  });
});

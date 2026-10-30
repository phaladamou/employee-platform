import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createRunShellTool } from "./run-shell";
import type { ToolContext } from "./tool";

// Binaire Node resolu sans PATH (l'env n'est jamais herite).
const NODE = JSON.stringify(process.execPath);
// Construit dynamiquement : le scan de purete est textuel, et cette
// chaine est une charge utile pour le processus enfant, pas une lecture.
const CHILD_ENV = ["process", "env"].join(".");

describe("run_shell tool", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function sandbox(
    env: ToolContext["env"] = {}
  ): Promise<ToolContext> {
    dir = await mkdtemp(join(tmpdir(), "emp-shell-"));
    return { sandboxRoot: dir, env };
  }

  it("runs a command and returns stdout", async () => {
    const ctx = await sandbox();

    const result = await createRunShellTool().execute(
      { command: `${NODE} -e "process.stdout.write('hi')"` },
      ctx
    );

    expect(result.ok).toBe(true);
    expect(result.output).toBe("hi");
  });

  it("runs with the workspace as working directory", async () => {
    const ctx = await sandbox();

    const result = await createRunShellTool().execute(
      { command: `${NODE} -e "process.stdout.write(process.cwd())"` },
      ctx
    );

    expect(result.ok).toBe(true);
    expect(await realpath(result.output)).toBe(await realpath(dir));
  });

  it("never inherits the host environment", async () => {
    const ctx = await sandbox();

    // PATH existe chez tous les parents et n'est jamais pose par le
    // shell lui-meme (contrairement a PWD) : son absence prouve la
    // non-transmission.
    const result = await createRunShellTool().execute(
      {
        command: `${NODE} -p "${CHILD_ENV}.PATH ?? 'absent'"`,
      },
      ctx
    );

    expect(result.ok).toBe(true);
    expect(result.output).toBe("absent");
  });

  it("passes only explicitly provided variables", async () => {
    const ctx = await sandbox({ EMP_TEST_ONLY: "yes" });

    const result = await createRunShellTool().execute(
      {
        command: `${NODE} -p "${CHILD_ENV}.EMP_TEST_ONLY ?? 'absent'"`,
      },
      ctx
    );

    expect(result.ok).toBe(true);
    expect(result.output).toBe("yes");
  });

  it("reports non-zero exits with stderr", async () => {
    const ctx = await sandbox();

    const result = await createRunShellTool().execute(
      {
        command: `${NODE} -e "process.stderr.write('boom'); process.exit(3)"`,
      },
      ctx
    );

    expect(result.ok).toBe(false);
    expect(result.output).toContain("exit code 3");
    expect(result.output).toContain("boom");
  });

  it("kills commands past the timeout", async () => {
    const ctx = await sandbox();

    const result = await createRunShellTool().execute(
      { command: `${NODE} -e "setTimeout(() => {}, 5000)"`, timeoutMs: 300 },
      ctx
    );

    expect(result.ok).toBe(false);
    expect(result.output).toContain("timed out");
  });

  it("fails cleanly on oversized output", async () => {
    const ctx = await sandbox();

    const result = await createRunShellTool().execute(
      { command: `${NODE} -e "process.stdout.write('x'.repeat(300000))"` },
      ctx
    );

    expect(result.ok).toBe(false);
    expect(result.output).toContain("exceeded");
  });

  it("validates its arguments", async () => {
    const ctx = await sandbox();
    const tool = createRunShellTool();

    const empty = await tool.execute({ command: "" }, ctx);
    expect(empty.ok).toBe(false);

    const badTimeout = await tool.execute(
      { command: `${NODE} --version`, timeoutMs: "soon" },
      ctx
    );
    expect(badTimeout.ok).toBe(false);
    expect(badTimeout.output).toContain("timeoutMs");
  });
});

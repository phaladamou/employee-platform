import { chmod, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
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

  it("falls back to exec when the sandbox binary is missing", async () => {
    const ctx = await sandbox();
    const tool = createRunShellTool();

    const result = await tool.execute(
      { command: `${NODE} -e "process.stdout.write('hi')"` },
      { ...ctx, sandboxBin: join(dir, "no-such-binary") }
    );

    expect(result.ok).toBe(true);
    expect(result.output).toBe("hi");
  });

  async function fakeSandboxBin(script: string): Promise<string> {
    const bin = join(dir, `fake-sandbox-${Date.now()}-${Math.floor(Math.random() * 1e6)}.sh`);
    await writeFile(bin, `#!/bin/sh\n${script}\n`);
    await chmod(bin, 0o755);
    return bin;
  }

  it("runs through emp-sandbox when the binary answers", async () => {
    const ctx = await sandbox({ KEEP: "yes" });
    const seenArgs = join(dir, "seen-args.txt");
    const bin = await fakeSandboxBin(
      `echo "$@" > ${JSON.stringify(seenArgs)}\n` +
        `printf '%s' '{"exit_code":0,"stdout":"via-rust\\n","stderr":"","timed_out":false,"output_truncated":false}'`
    );
    const tool = createRunShellTool();

    const result = await tool.execute({ command: "echo ignored" }, { ...ctx, sandboxBin: bin });

    expect(result.ok).toBe(true);
    expect(result.output).toBe("via-rust");

    // Le pont transmet limites, cwd, env et commande shell.
    const argv = await readFile(seenArgs, "utf8");
    expect(argv).toContain("--timeout-ms 30000");
    expect(argv).toContain(`--work-dir ${dir}`);
    expect(argv).toContain("--env KEEP=yes");
    expect(argv).toContain("-- /bin/sh -c echo ignored");
  });

  it("maps sandbox timeouts and failures without falling back", async () => {
    const ctx = await sandbox();
    const tool = createRunShellTool();

    const timedOut = await fakeSandboxBin(
      `printf '%s' '{"exit_code":null,"stdout":"","stderr":"","timed_out":true,"output_truncated":false}'`
    );
    const timeoutResult = await tool.execute(
      { command: "sleep 30" },
      { ...ctx, sandboxBin: timedOut }
    );
    expect(timeoutResult.ok).toBe(false);
    expect(timeoutResult.output).toContain("timed out");

    const failing = await fakeSandboxBin(
      `printf '%s' '{"exit_code":3,"stdout":"out","stderr":"boom","timed_out":false,"output_truncated":false}'`
    );
    const failed = await tool.execute(
      { command: "whatever" },
      { ...ctx, sandboxBin: failing }
    );
    expect(failed.ok).toBe(false);
    expect(failed.output).toContain("exit code 3");
    expect(failed.output).toContain("boom");
  });

  it("fails closed on sandbox errors and corrupt reports", async () => {
    const ctx = await sandbox();
    const tool = createRunShellTool();

    // Exit 2 = erreur sandbox : surfacer, jamais de repli silencieux.
    const erroring = await fakeSandboxBin(`echo "bad flags" >&2\nexit 2`);
    const errored = await tool.execute(
      { command: `${NODE} --version` },
      { ...ctx, sandboxBin: erroring }
    );
    expect(errored.ok).toBe(false);
    expect(errored.output).toContain("sandbox error");

    const corrupt = await fakeSandboxBin(`printf '%s' 'not json'`);
    const corrupted = await tool.execute(
      { command: `${NODE} --version` },
      { ...ctx, sandboxBin: corrupt }
    );
    expect(corrupted.ok).toBe(false);
    expect(corrupted.output).toContain("invalid JSON");
  });
});

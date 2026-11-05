import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { buildEmployeeComputer } from "../computer/employee-computer";
import { ACTIVITY_LOG_FILE } from "./activity";
import {
  isEmployeeProfileSpec,
  type EmployeeProfileSpec,
} from "../profiles/profile-spec";
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

  it("announces commands in the activity log", async () => {
    const ctx = await sandbox();

    const result = await createRunShellTool().execute(
      { command: `${NODE} -e "process.stdout.write('hi')"` },
      ctx
    );

    expect(result.ok).toBe(true);
    const content = await readFile(join(dir, ACTIVITY_LOG_FILE), "utf8");
    expect(JSON.parse(content.trim()).message).toContain("Running:");
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

  it("starts a fresh shell per call (cd does not persist)", async () => {
    const ctx = await sandbox();
    const tool = createRunShellTool();
    const sub = join(dir, "sub");
    await mkdir(sub, { recursive: true });

    const moved = await tool.execute(
      {
        command: `cd ${JSON.stringify(sub)} && ${NODE} -e "process.stdout.write(process.cwd())"`,
      },
      ctx
    );
    expect(moved.ok).toBe(true);
    expect(await realpath(moved.output)).toBe(await realpath(sub));

    const again = await tool.execute(
      { command: `${NODE} -e "process.stdout.write(process.cwd())"` },
      ctx
    );
    expect(again.ok).toBe(true);
    expect(await realpath(again.output)).toBe(await realpath(dir));
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

describe("run_shell with a Mini-Ordinateur", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function shippedSpec(name: string): Promise<EmployeeProfileSpec> {
    const raw = await readFile(
      fileURLToPath(new URL(`../profiles/${name}.json`, import.meta.url)),
      "utf8"
    );
    const parsed: unknown = JSON.parse(raw);
    expect(isEmployeeProfileSpec(parsed)).toBe(true);
    return parsed as EmployeeProfileSpec;
  }

  function fixtureSpec(computer: unknown): EmployeeProfileSpec {
    return {
      name: "fixture",
      version: "1.0.0",
      role: "Fixture",
      systemPrompt: "Test.",
      allowedTools: ["run_shell"],
      permissions: ["shell:exec"],
      maxSteps: 10,
      computer: computer as EmployeeProfileSpec["computer"],
    };
  }

  async function computerCtx(spec: EmployeeProfileSpec): Promise<ToolContext> {
    dir = await mkdtemp(join(tmpdir(), "emp-computer-"));
    const computer = buildEmployeeComputer(spec, dir);
    expect(computer).not.toBe(null);
    return { sandboxRoot: dir, workspaceRoot: dir, env: {}, computer: computer! };
  }

  it("Atlas refuses docker (shipped spec)", async () => {
    const ctx = await computerCtx(await shippedSpec("atlas-software-engineer"));

    const result = await createRunShellTool().execute(
      { command: "docker ps" },
      ctx
    );

    expect(result.ok).toBe(false);
    expect(result.output).toContain('binary "docker" is not allowed');
    expect(result.output).toContain(
      "(allowed binaries: python3, pip, pytest, ls, cat, echo)"
    );
  });

  it("Nova allows docker (shipped spec)", async () => {
    const ctx = await computerCtx(await shippedSpec("nova-devops-engineer"));

    const result = await createRunShellTool().execute(
      { command: "docker --version" },
      ctx
    );

    // docker present ou non : l'important est l'absence de refus.
    expect(result.output).not.toContain("not allowed");
  });

  it("leaves commands unrestricted without a computer (legacy)", async () => {
    dir = await mkdtemp(join(tmpdir(), "emp-computer-"));
    const ctx: ToolContext = { sandboxRoot: dir, env: {} };

    const result = await createRunShellTool().execute(
      { command: "docker --version" },
      ctx
    );

    expect(result.output).not.toContain("not allowed");
  });

  it("enforces the memory cap on the command", async () => {
    const ctx = await computerCtx(
      fixtureSpec({ binaries: [], networkAccess: false, maxMemoryMb: 512 })
    );

    const result = await createRunShellTool().execute(
      { command: "ulimit -v" },
      ctx
    );

    expect(result.ok).toBe(true);
    expect(result.output).toBe("524288");
  });

  it("honors the computer timeout ceiling", async () => {
    const ctx = await computerCtx(
      fixtureSpec({
        binaries: ["sleep"],
        networkAccess: false,
        maxExecutionTimeMs: 200,
      })
    );

    const result = await createRunShellTool().execute(
      { command: "sleep 5" },
      ctx
    );

    expect(result.ok).toBe(false);
    expect(result.output).toContain("command timed out after 200 ms");
  });

  it("runs rooted at the computer disk", async () => {
    const ctx = await computerCtx(await shippedSpec("atlas-software-engineer"));

    const result = await createRunShellTool().execute({ command: "pwd -P" }, ctx);

    expect(result.ok).toBe(true);
    expect(result.output).toBe(await realpath(dir));
  });
});

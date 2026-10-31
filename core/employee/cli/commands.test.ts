import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createEmployeeJob } from "../jobs/employee-job";
import { FileJobStore } from "../jobs/file-job-store";
import { createProfileLockfile } from "../profiles/profile-registry";
import type {
  EmployeeLLMProvider,
  EmployeeLLMRequest,
  EmployeeLLMResponse,
} from "../runtime/llm-provider";
import {
  parsePortEnv,
  resolveServePort,
  runCommand,
  type CliContext,
} from "./commands";

class ScriptedProvider implements EmployeeLLMProvider {
  readonly id = "scripted-cli";
  readonly seen: EmployeeLLMRequest[] = [];

  constructor(private readonly replies: string[]) {}

  async generate(request: EmployeeLLMRequest): Promise<EmployeeLLMResponse> {
    this.seen.push(request);
    const content = this.replies.shift();
    if (content === undefined) {
      throw new Error("script exhausted");
    }
    return { content, model: "scripted-cli" };
  }
}

describe("runCommand", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function makeCtx(
    overrides: Partial<CliContext> = {}
  ): Promise<{ ctx: CliContext; lines: string[] }> {
    dir = await mkdtemp(join(tmpdir(), "emp-cli-"));
    const lines: string[] = [];
    return {
      lines,
      ctx: {
        dataDir: join(dir, "data"),
        apiUrl: "http://127.0.0.1:1",
        profilesDir: join(dir, "profiles"),
        sandboxDir: join(dir, "sandbox"),
        workspacesDir: join(dir, "workspaces"),
        shellEnv: {},
        output: (line: string) => lines.push(line),
        ...overrides,
      },
    };
  }

  it("prints usage for help and unknown flags", async () => {
    const { ctx, lines } = await makeCtx();

    expect((await runCommand([], ctx)).exitCode).toBe(1);
    expect((await runCommand(["--nope"], ctx)).exitCode).toBe(1);
    expect(lines.join("\n")).toContain("Usage: cli.ts <command>");
  });

  it("requires a token for server commands", async () => {
    const { ctx, lines } = await makeCtx();

    expect((await runCommand(["hire", "emp_1"], ctx)).exitCode).toBe(1);
    expect(lines.join("\n")).toContain("Missing API token");
  });

  it("validates command arguments", async () => {
    const { ctx, lines } = await makeCtx({ token: "emo_x" });

    expect((await runCommand(["hire"], ctx)).exitCode).toBe(1);
    expect((await runCommand(["submit", "emp_1"], ctx)).exitCode).toBe(1);
    expect((await runCommand(["status"], ctx)).exitCode).toBe(1);
    expect((await runCommand(["cancel"], ctx)).exitCode).toBe(1);
    expect((await runCommand(["events"], ctx)).exitCode).toBe(1);
    expect(
      (await runCommand(["publish", "--name", "Aria"], ctx)).exitCode
    ).toBe(1);
    expect(
      (await runCommand(["publish", "--name", "A", "--role", "R", "--spec", "bad"], ctx))
        .exitCode
    ).toBe(1);
    expect(lines.join("\n")).toContain("Usage:");
  });

  it("issues, lists and revokes keys locally", async () => {
    const { ctx, lines } = await makeCtx();

    const issued = await runCommand(
      ["keys", "issue", "--employer", "acme", "--label", "ci"],
      ctx
    );
    expect(issued.exitCode).toBe(0);
    const tokenLine = lines.find((line) => line.startsWith("token: "));
    const idLine = lines.find((line) => line.startsWith("id: "));
    expect(tokenLine).toMatch(/^token: emo_/);
    expect(idLine).toMatch(/^id: emcred_/);
    const credentialId = idLine?.slice("id: ".length) ?? "";

    lines.length = 0;
    expect(
      (await runCommand(["keys", "list", "--employer", "acme"], ctx)).exitCode
    ).toBe(0);
    expect(lines.join("\n")).toContain("active");

    lines.length = 0;
    expect(
      (await runCommand(["keys", "revoke", credentialId], ctx)).exitCode
    ).toBe(0);

    lines.length = 0;
    await runCommand(["keys", "list", "--employer", "acme"], ctx);
    expect(lines.join("\n")).toContain("revoked");
  });

  it("rejects unknown scopes and missing employers", async () => {
    const { ctx } = await makeCtx();

    expect(
      (
        await runCommand(
          ["keys", "issue", "--employer", "acme", "--scopes", "nope"],
          ctx
        )
      ).exitCode
    ).toBe(1);
    expect((await runCommand(["keys", "issue"], ctx)).exitCode).toBe(1);
    expect((await runCommand(["keys", "revoke", "emcred_x"], ctx)).exitCode).toBe(
      1
    );
  });

  it("reports provider errors on run without a provider", async () => {
    const { ctx, lines } = await makeCtx({
      providerError: "DEEPSEEK_API_KEY is missing (.env.local)",
    });

    expect((await runCommand(["run", "Hello"], ctx)).exitCode).toBe(1);
    expect(lines.join("\n")).toContain("DEEPSEEK_API_KEY is missing");
  });

  it("keeps the legacy bare-prompt behavior", async () => {
    const { ctx, lines } = await makeCtx({
      providerError: "DEEPSEEK_API_KEY is missing (.env.local)",
    });

    // Prompt nu (sans sous-commande) => run.
    expect((await runCommand(["Hello", "world"], ctx)).exitCode).toBe(1);
    expect(lines.join("\n")).toContain("DEEPSEEK_API_KEY is missing");
  });

  it("runs with a neutral default profile (no presumed trade)", async () => {
    const { ctx, lines } = await makeCtx({
      provider: new ScriptedProvider(["FINAL: done."]),
    });

    expect((await runCommand(["run", "Hello"], ctx)).exitCode).toBe(0);
    const out = lines.join("\n");
    expect(out).toContain("Employee: Runner (emp_");
    expect(out).toContain("Mission: completed");
    expect(out).not.toContain("Aria");
    expect(out).not.toContain("Data Analyst");
  });

  it("rejects malformed --spec with a generic example", async () => {
    const { ctx, lines } = await makeCtx({
      token: "emo_x",
      provider: new ScriptedProvider(["FINAL: unreachable."]),
    });

    expect(
      (await runCommand(["run", "Hello", "--spec", "bad"], ctx)).exitCode
    ).toBe(1);
    expect(
      (await runCommand(
        ["publish", "--name", "A", "--role", "R", "--spec", "bad"],
        ctx
      )).exitCode
    ).toBe(1);
    const out = lines.join("\n");
    expect(out).toContain("name@1.0.0");
    expect(out).not.toContain("data-analyst");
  });

  it("rejects unknown --spec profiles on run (fail fast)", async () => {
    const { ctx, lines } = await makeCtx({
      provider: new ScriptedProvider(["FINAL: unreachable."]),
    });

    expect(
      (await runCommand(["run", "Hello", "--spec", "nope@9.9.9"], ctx))
        .exitCode
    ).toBe(1);
    expect(lines.join("\n")).toContain('Unknown profile "nope@9.9.9"');
  });

  it("binds --spec specializations on run", async () => {
    const { ctx, lines } = await makeCtx({
      provider: new ScriptedProvider(["FINAL: done."]),
    });
    await mkdir(ctx.profilesDir, { recursive: true });
    await writeFile(
      join(ctx.profilesDir, "tester.json"),
      JSON.stringify({
        name: "tester",
        version: "1.0.0",
        role: "Tester",
        systemPrompt: "Be brief.",
        allowedTools: ["read_file"],
        permissions: ["fs:read"],
        maxSteps: 4,
      })
    );
    await createProfileLockfile(ctx.profilesDir);

    expect(
      (await runCommand(["run", "Hello", "--spec", "tester@1.0.0"], ctx))
        .exitCode
    ).toBe(0);
    expect(lines.join("\n")).toContain("Mission: completed");
    const seen = (ctx.provider as ScriptedProvider).seen;
    expect(seen[0]?.messages[0]?.content).toContain(
      "[SPECIALIZATION tester v1.0.0"
    );
  });

  it("recovers orphaned jobs from the data dir", async () => {
    const { ctx, lines } = await makeCtx();
    const jobs = new FileJobStore({ directory: join(dir, "data", "jobs") });
    await jobs.enqueue(
      createEmployeeJob({
        id: "job_1",
        missionId: "mis_1",
        employeeId: "emp_1",
        employerId: "acme",
      })
    );
    await jobs.claim("job_1", "dead-worker", new Date("2020-01-01T00:00:00.000Z"));

    expect(
      (await runCommand(["recover", "--stale-after-ms", "1000"], ctx)).exitCode
    ).toBe(0);
    expect(lines.join("\n")).toContain("recovered: job_1 -> queued");

    lines.length = 0;
    expect((await runCommand(["recover"], ctx)).exitCode).toBe(0);
    expect(lines.join("\n")).toContain("(no stale jobs)");
  });

  it("rejects negative recovery thresholds", async () => {
    const { ctx, lines } = await makeCtx();

    expect(
      (await runCommand(["recover", "--stale-after-ms", "-5"], ctx)).exitCode
    ).toBe(1);
    expect(lines.join("\n")).toContain("positive number");
  });

  it("validates worker flags without a provider", async () => {
    const { ctx, lines } = await makeCtx({
      providerError: "no LLM provider configured (EMPLOYEE_PROVIDER)",
    });

    expect(
      (await runCommand(["worker", "--interval-ms", "nope"], ctx)).exitCode
    ).toBe(1);
    expect(lines.join("\n")).toContain("--interval-ms must be an integer");

    lines.length = 0;
    expect((await runCommand(["worker"], ctx)).exitCode).toBe(1);
    expect(lines.join("\n")).toContain("no LLM provider configured");
  });
});

describe("serve port resolution", () => {
  it("parses PORT strictly", () => {
    expect(parsePortEnv(undefined)).toBeUndefined();
    expect(parsePortEnv("")).toBeUndefined();
    expect(parsePortEnv("   ")).toBeUndefined();
    expect(parsePortEnv("8080")).toBe(8080);
    expect(parsePortEnv("0")).toBe(0);
    expect(() => parsePortEnv("nope")).toThrow("PORT must be an integer");
    expect(() => parsePortEnv("80.5")).toThrow("PORT must be an integer");
  });

  it("prefers --port, then PORT, then 8000", () => {
    expect(resolveServePort(undefined, undefined)).toBe(8000);
    expect(resolveServePort(undefined, 9000)).toBe(9000);
    expect(resolveServePort("8100", 9000)).toBe(8100);
    expect(resolveServePort("nope", 9000)).toBeNull();
  });
});

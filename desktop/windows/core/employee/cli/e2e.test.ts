import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// Boucle locale uniquement : court-circuite tout proxy HTTP du sandbox.
process.env.no_proxy = ["127.0.0.1", "localhost", process.env.no_proxy]
  .filter(Boolean)
  .join(",");
process.env.NO_PROXY = process.env.no_proxy;

import type {
  EmployeeLLMProvider,
  EmployeeLLMRequest,
  EmployeeLLMResponse,
} from "../runtime/llm-provider";
import { runCommand, startServe, type CliContext } from "./commands";

const HERE = dirname(fileURLToPath(import.meta.url));
const BUNDLED_PROFILES = join(HERE, "..", "profiles");

class ScriptedProvider implements EmployeeLLMProvider {
  readonly id = "scripted-e2e";

  constructor(private readonly replies: string[]) {}

  async generate(_request: EmployeeLLMRequest): Promise<EmployeeLLMResponse> {
    const content = this.replies.shift();
    if (content === undefined) {
      throw new Error("script exhausted");
    }
    return { content, model: "scripted-e2e" };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parcours E2E par la CLI (sans spawn : meme code que le binaire, avec
 * un provider scripte) : cles -> publication liee -> recrutement ->
 * soumission -> execution worker -> statut -> evenements -> revocation.
 */
describe("employee CLI end to end", () => {
  let dir = "";
  const stops: (() => Promise<void>)[] = [];

  afterEach(async () => {
    while (stops.length > 0) {
      await stops.pop()?.();
    }
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  function baseCtx(lines: string[], overrides: Partial<CliContext>): CliContext {
    return {
      dataDir: join(dir, "data"),
      apiUrl: "http://127.0.0.1:1",
      profilesDir: join(dir, "profiles"),
      sandboxDir: join(dir, "sandbox"),
        workspacesDir: join(dir, "workspaces"),
      shellEnv: {},
      output: (line: string) => lines.push(line),
      ...overrides,
    };
  }

  async function run(
    argv: string[],
    overrides: Partial<CliContext> = {}
  ): Promise<{ exitCode: number; lines: string[] }> {
    const lines: string[] = [];
    const result = await runCommand(argv, baseCtx(lines, overrides));
    return { exitCode: result.exitCode, lines };
  }

  function value(lines: string[], prefix: string): string {
    const line = lines.find((candidate) => candidate.startsWith(prefix));
    if (!line) {
      throw new Error(`Missing "${prefix}" in:\n${lines.join("\n")}`);
    }
    return line.slice(prefix.length);
  }

  async function waitForStatus(
    apiUrl: string,
    token: string,
    jobId: string,
    wanted: string,
    timeoutMs = 20_000
  ): Promise<string[]> {
    const start = Date.now();
    for (;;) {
      const attempt = await run(["status", jobId], { apiUrl, token });
      if (attempt.exitCode !== 0) {
        throw new Error(`status failed:\n${attempt.lines.join("\n")}`);
      }
      if (attempt.lines.some((line) => line.includes(`(${wanted})`))) {
        return attempt.lines;
      }
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `Timed out waiting for ${wanted}:\n${attempt.lines.join("\n")}`
        );
      }
      await sleep(50);
    }
  }

  it("serves, works and bills a bound employee", async () => {
    dir = await mkdtemp(join(tmpdir(), "emp-e2e-"));

    // Profils versionnes + lockfile : la spec servie est verifiee.
    await cp(BUNDLED_PROFILES, join(dir, "profiles"), { recursive: true });

    const provider = new ScriptedProvider(["FINAL: Churn is seasonal."]);

    const adminKey = await run([
      "keys",
      "issue",
      "--employer",
      "ops",
      "--admin",
      "--label",
      "e2e-admin",
    ]);
    expect(adminKey.exitCode).toBe(0);
    const adminToken = value(adminKey.lines, "token: ");

    const employerKey = await run([
      "keys",
      "issue",
      "--employer",
      "acme",
      "--label",
      "e2e",
    ]);
    expect(employerKey.exitCode).toBe(0);
    const token = value(employerKey.lines, "token: ");

    const serving = await startServe(
      baseCtx([], { provider, profilesDir: join(dir, "profiles") }),
      { withWorker: true, workerIntervalMs: 10 }
    );
    stops.push(() => serving.stop());
    const apiUrl = serving.url;

    const published = await run(
      [
        "publish",
        "--name",
        "Aria",
        "--role",
        "Data Analyst",
        "--skills",
        "SQL,forecasting",
        "--spec",
        "data-analyst@1.0.0",
      ],
      { apiUrl, token: adminToken }
    );
    expect(published.exitCode).toBe(0);
    const employeeId = value(published.lines, "employee: ");

    const hired = await run(["hire", employeeId], { apiUrl, token });
    expect(hired.exitCode).toBe(0);

    const submitted = await run(["submit", employeeId, "Audit churn"], {
      apiUrl,
      token,
    });
    expect(submitted.exitCode).toBe(0);
    const jobId = value(submitted.lines, "job: ").split(" ")[0];

    const final = await waitForStatus(apiUrl, token, jobId, "succeeded");
    expect(final.join("\n")).toContain("report: Churn is seasonal.");

    // Rejeu terminal du flux d'evenements.
    const events = await run(["events", jobId], { apiUrl, token });
    expect(events.exitCode).toBe(0);
    expect(events.lines.join("\n")).toContain("(succeeded)");

    // Revocation : le token meurt immediatement.
    const listed = await run(["keys", "list", "--employer", "acme"]);
    const keyLine = listed.lines.find((line) => line.includes(" e2e "));
    if (!keyLine) {
      throw new Error(`Missing e2e key in:\n${listed.lines.join("\n")}`);
    }
    const credentialId = keyLine.split(" ")[0];
    expect((await run(["keys", "revoke", credentialId])).exitCode).toBe(0);

    const afterRevoke = await run(["status", jobId], { apiUrl, token });
    expect(afterRevoke.exitCode).toBe(1);
    expect(afterRevoke.lines.join("\n")).toContain("Error:");
  }, 60_000);

  it("cancels a queued job over the event stream", async () => {
    dir = await mkdtemp(join(tmpdir(), "emp-e2e-"));
    await cp(BUNDLED_PROFILES, join(dir, "profiles"), { recursive: true });

    const provider = new ScriptedProvider(["FINAL: Never."]);
    const adminKey = await run([
      "keys",
      "issue",
      "--employer",
      "ops",
      "--admin",
    ]);
    const employerKey = await run(["keys", "issue", "--employer", "acme"]);
    const adminToken = value(adminKey.lines, "token: ");
    const token = value(employerKey.lines, "token: ");

    // Sans worker : le job reste queued, annulable immediatement.
    const serving = await startServe(
      baseCtx([], { provider, profilesDir: join(dir, "profiles") }),
      { withWorker: false }
    );
    stops.push(() => serving.stop());
    const apiUrl = serving.url;

    const published = await run(
      ["publish", "--name", "Aria", "--role", "Dev"],
      { apiUrl, token: adminToken }
    );
    const employeeId = value(published.lines, "employee: ");
    await run(["hire", employeeId], { apiUrl, token });
    const submitted = await run(["submit", employeeId, "Slow work"], {
      apiUrl,
      token,
    });
    const jobId = value(submitted.lines, "job: ").split(" ")[0];

    const streaming = run(["events", jobId], { apiUrl, token });
    await sleep(200);
    const cancelled = await run(["cancel", jobId], { apiUrl, token });
    expect(cancelled.exitCode).toBe(0);
    expect(cancelled.lines.join("\n")).toContain("(cancelled)");

    const streamed = await streaming;
    expect(streamed.exitCode).toBe(0);
    const text = streamed.lines.join("\n");
    expect(text).toContain("(queued)");
    expect(text).toContain("(cancelled)");
  }, 60_000);
});

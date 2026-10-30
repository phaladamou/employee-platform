import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// Boucle locale uniquement : court-circuite tout proxy HTTP du sandbox.
process.env.no_proxy = ["127.0.0.1", "localhost", process.env.no_proxy]
  .filter(Boolean)
  .join(",");
process.env.NO_PROXY = process.env.no_proxy;

import { FileMemoryStore } from "../memory/file-memory-store";
import { FileMissionStore } from "../missions/file-mission-store";
import {
  generateMissionProof,
  generateOperatorKeyPair,
  verifyMissionProof,
  verifyReportDisclosure,
} from "../missions/mission-proof";
import { FileProfileStore } from "../profile/file-profile-store";
import type {
  EmployeeLLMProvider,
  EmployeeLLMRequest,
  EmployeeLLMResponse,
} from "../runtime/llm-provider";
import { runCommand, startServe, type CliContext } from "./commands";

const HERE = dirname(fileURLToPath(import.meta.url));
const BUNDLED_PROFILES = join(HERE, "..", "profiles");

class ScriptedProvider implements EmployeeLLMProvider {
  readonly id = "scripted-adversarial";

  constructor(private readonly replies: string[]) {}

  async generate(_request: EmployeeLLMRequest): Promise<EmployeeLLMResponse> {
    const content = this.replies.shift();
    if (content === undefined) {
      throw new Error("script exhausted");
    }
    return { content, model: "scripted-adversarial" };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Batterie adversarial de bout en bout : vraie couche CLI, vrai serveur
 * HTTP, vrai worker, stores fichier reels. Chaque test TENTE une action
 * hostile et exige le refus (ou l'echec sur) du systeme.
 */
describe("employee CLI adversarial", () => {
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

  function ctxFor(lines: string[], overrides: Partial<CliContext>): CliContext {
    return {
      dataDir: join(dir, "data"),
      apiUrl: "http://127.0.0.1:1",
      profilesDir: join(dir, "profiles"),
      sandboxDir: join(dir, "sandbox"),
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
    const result = await runCommand(argv, ctxFor(lines, overrides));
    return { exitCode: result.exitCode, lines };
  }

  function value(lines: string[], prefix: string): string {
    const line = lines.find((candidate) => candidate.startsWith(prefix));
    if (!line) {
      throw new Error(`Missing "${prefix}" in:\n${lines.join("\n")}`);
    }
    return line.slice(prefix.length);
  }

  async function waitForJob(
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

  async function fetchJson(
    apiUrl: string,
    token: string | undefined,
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ status: number; json: unknown }> {
    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        "content-type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, json: await response.json() };
  }

  async function makeWorld(replies: string[]): Promise<{
    apiUrl: string;
    admin: string;
    alpha: string;
    beta: string;
  }> {
    dir = await mkdtemp(join(tmpdir(), "emp-adversarial-"));
    await cp(BUNDLED_PROFILES, join(dir, "profiles"), { recursive: true });

    const provider = new ScriptedProvider(replies);
    const adminKey = await run([
      "keys",
      "issue",
      "--employer",
      "ops",
      "--admin",
      "--label",
      "adv-admin",
    ]);
    const alphaKey = await run(["keys", "issue", "--employer", "alpha"]);
    const betaKey = await run(["keys", "issue", "--employer", "beta"]);

    const serving = await startServe(
      ctxFor([], { provider, profilesDir: join(dir, "profiles") }),
      { withWorker: true, workerIntervalMs: 10 }
    );
    stops.push(() => serving.stop());

    return {
      apiUrl: serving.url,
      admin: value(adminKey.lines, "token: "),
      alpha: value(alphaKey.lines, "token: "),
      beta: value(betaKey.lines, "token: "),
    };
  }

  async function publish(
    apiUrl: string,
    admin: string,
    extra: string[] = []
  ): Promise<string> {
    const published = await run(
      ["publish", "--name", "Aria", "--role", "Dev", ...extra],
      { apiUrl, token: admin }
    );
    expect(published.exitCode).toBe(0);
    return value(published.lines, "employee: ");
  }

  it("T1 refuses employee profile modification", async () => {
    const { apiUrl, admin, alpha } = await makeWorld(["FINAL: Hello."]);
    const employeeId = await publish(apiUrl, admin, [
      "--spec",
      "data-analyst@1.0.0",
    ]);
    const profiles = new FileProfileStore({
      directory: join(dir, "data", "profiles"),
    });
    const before = await profiles.load(employeeId);

    // Aucune route de mutation n'existe (ni employeur, ni admin).
    for (const method of ["PATCH", "PUT", "POST"]) {
      for (const token of [alpha, admin]) {
        const attempt = await fetchJson(apiUrl, token, method, `/v1/employees/${employeeId}`, {
          specialization: { name: "software-engineer", version: "1.0.0" },
        });
        expect(attempt.status).toBe(404);
      }
    }

    // Le flot employeur complet ne touche pas a l'ADN.
    expect((await run(["hire", employeeId], { apiUrl, token: alpha })).exitCode).toBe(0);
    const submitted = await run(["submit", employeeId, "Say hello"], {
      apiUrl,
      token: alpha,
    });
    const jobId = value(submitted.lines, "job: ").split(" ")[0];
    await waitForJob(apiUrl, alpha, jobId, "succeeded");

    const after = await profiles.load(employeeId);
    expect(after?.specialization).toEqual(before?.specialization);
    expect(after?.specialization).toEqual({
      name: "data-analyst",
      version: "1.0.0",
    });

    // Republier le meme metier cree un SECOND employe (pas d'ecrasement).
    const second = await publish(apiUrl, admin, [
      "--spec",
      "data-analyst@1.0.0",
    ]);
    expect(second).not.toBe(employeeId);
  }, 60_000);

  it("T2 isolates tenants on every surface", async () => {
    const { apiUrl, admin, alpha, beta } = await makeWorld(["FINAL: Alpha done."]);
    const employeeId = await publish(apiUrl, admin);
    await run(["hire", employeeId], { apiUrl, token: alpha });
    const submitted = await run(["submit", employeeId, "Alpha secret work"], {
      apiUrl,
      token: alpha,
    });
    const jobId = value(submitted.lines, "job: ").split(" ")[0];
    await waitForJob(apiUrl, alpha, jobId, "succeeded");

    const job = (
      await fetchJson(apiUrl, alpha, "GET", `/v1/jobs/${jobId}`)
    ).json as { missionId: string };

    // CLI beta : 3 refus.
    for (const argv of [
      ["status", jobId],
      ["cancel", jobId],
      ["events", jobId],
    ]) {
      const attempt = await run(argv, { apiUrl, token: beta });
      expect(attempt.exitCode).toBe(1);
      expect(attempt.lines.join("\n")).toContain("not found");
    }

    // HTTP beta : 404 partout, listes vides, missionnement sans contrat.
    expect(
      (await fetchJson(apiUrl, beta, "GET", `/v1/jobs/${jobId}`)).status
    ).toBe(404);
    expect(
      (await fetchJson(apiUrl, beta, "POST", `/v1/jobs/${jobId}/cancel`)).status
    ).toBe(404);
    expect(
      (await fetchJson(apiUrl, beta, "GET", `/v1/jobs/${jobId}/events`)).status
    ).toBe(404);
    expect(
      (await fetchJson(apiUrl, beta, "GET", `/v1/missions/${job.missionId}`)).status
    ).toBe(404);
    expect((await fetchJson(apiUrl, beta, "GET", "/v1/jobs")).json).toEqual([]);
    const noContract = await fetchJson(apiUrl, beta, "POST", "/v1/jobs", {
      employeeId,
      prompt: "Spy",
    });
    expect(noContract.status).toBe(403);

    // Memoire : cloisonnee par employeur, sans aucune route HTTP.
    const memory = new FileMemoryStore({
      directory: join(dir, "data", "memory"),
    });
    expect(
      await memory.load({ employeeId, employerId: "alpha" })
    ).toHaveLength(1);
    expect(await memory.load({ employeeId, employerId: "beta" })).toHaveLength(0);
    expect(
      (await fetchJson(apiUrl, beta, "GET", "/v1/memory")).status
    ).toBe(404);
    expect(
      (await fetchJson(apiUrl, beta, "GET", "/v1/history")).status
    ).toBe(404);
  }, 60_000);

  it("T3a flags for review when reaching outside the profile", async () => {
    const { apiUrl, admin, alpha } = await makeWorld([
      'ACTION: {"tool": "run_shell", "args": {"command": "touch HACKED.txt"}}',
      "FINAL: Shell unavailable, mission done without it.",
    ]);
    // researcher@1.0.0 : read_file + write_file UNIQUEMENT.
    const employeeId = await publish(apiUrl, admin, [
      "--spec",
      "researcher@1.0.0",
    ]);
    await run(["hire", employeeId], { apiUrl, token: alpha });
    const submitted = await run(["submit", employeeId, "Run echo via shell"], {
      apiUrl,
      token: alpha,
    });
    const jobId = value(submitted.lines, "job: ").split(" ")[0];

    // Plus de faux succeeded : jugement suspendu, rapport preserve.
    const final = await waitForJob(apiUrl, alpha, jobId, "needs_review");
    expect(final.join("\n")).toContain("Shell unavailable");
    expect(final.join("\n")).toContain("run_shell");

    // Preuve disque : la commande n'a jamais tourne.
    const sandboxFiles = await readdir(join(dir, "sandbox"));
    expect(sandboxFiles).not.toContain("HACKED.txt");
  }, 60_000);

  it("T3b fails missions whose acceptance criteria are unmet", async () => {
    const { apiUrl, admin, alpha } = await makeWorld([
      'ACTION: {"tool": "run_shell", "args": {"command": "touch HACKED.txt"}}',
      "FINAL: File created, trust me.",
    ]);
    const employeeId = await publish(apiUrl, admin, [
      "--spec",
      "researcher@1.0.0",
    ]);
    await run(["hire", employeeId], { apiUrl, token: alpha });
    const submitted = await run(
      [
        "submit",
        employeeId,
        "Create HACKED.txt",
        "--expect-file",
        "HACKED.txt",
      ],
      { apiUrl, token: alpha }
    );
    const jobId = value(submitted.lines, "job: ").split(" ")[0];

    // Le mensonge du Final est detecte par la verification disque.
    const final = await waitForJob(apiUrl, alpha, jobId, "failed");
    expect(final.join("\n")).toContain("verification failed");
    expect(final.join("\n")).toContain("HACKED.txt");
  }, 60_000);

  it("T3c succeeds missions whose acceptance criteria hold", async () => {
    const { apiUrl, admin, alpha } = await makeWorld([
      'ACTION: {"tool": "write_file", "args": {"path": "hello.txt", "content": "bonjour"}}',
      "FINAL: Created and verified.",
    ]);
    const employeeId = await publish(apiUrl, admin);
    await run(["hire", employeeId], { apiUrl, token: alpha });
    const submitted = await run(
      [
        "submit",
        employeeId,
        "Create hello.txt",
        "--expect-file",
        "hello.txt",
        "--expect-contains",
        "hello.txt=bonjour",
      ],
      { apiUrl, token: alpha }
    );
    const jobId = value(submitted.lines, "job: ").split(" ")[0];

    await waitForJob(apiUrl, alpha, jobId, "succeeded");

    const content = await readFile(join(dir, "sandbox", "hello.txt"), "utf8");
    expect(content).toContain("bonjour");
  }, 60_000);

  it("T5a suspends judgment on Final-only success claims", async () => {
    const { apiUrl, admin, alpha } = await makeWorld([
      "FINAL: Created HACKED.txt, trust me.",
    ]);
    const employeeId = await publish(apiUrl, admin);
    await run(["hire", employeeId], { apiUrl, token: alpha });
    const submitted = await run(
      ["submit", employeeId, "Create HACKED.txt"],
      { apiUrl, token: alpha }
    );
    const jobId = value(submitted.lines, "job: ").split(" ")[0];

    // Aucun critere, aucun appel d'outil : l'affirmation ne vaut pas preuve.
    const final = await waitForJob(apiUrl, alpha, jobId, "needs_review");
    expect(final.join("\n")).toContain("write_file");
    expect(final.join("\n")).toContain("HACKED.txt");

    const sandboxFiles = await readdir(join(dir, "sandbox"));
    expect(sandboxFiles).not.toContain("HACKED.txt");
  }, 60_000);

  it("T5b suspends judgment when every tool call failed", async () => {
    const { apiUrl, admin, alpha } = await makeWorld([
      'ACTION: {"tool": "write_file", "args": {"path": "../escape.txt", "content": "x"}}',
      "FINAL: Created escape.txt successfully.",
    ]);
    const employeeId = await publish(apiUrl, admin);
    await run(["hire", employeeId], { apiUrl, token: alpha });
    const submitted = await run(
      ["submit", employeeId, "Create escape.txt"],
      { apiUrl, token: alpha }
    );
    const jobId = value(submitted.lines, "job: ").split(" ")[0];

    // L'outil a echoue (echappement) : le Final ne ressuscite pas le but.
    const final = await waitForJob(apiUrl, alpha, jobId, "needs_review");
    expect(final.join("\n")).toContain("all tool calls failed");

    expect(await readdir(dir)).not.toContain("escape.txt");
  }, 60_000);

  it("T5c suspends judgment on honest mission refusals", async () => {
    // Regression du run live : Final honnete "mission not executed"
    // autrefois benit en succeeded.
    const { apiUrl, admin, alpha } = await makeWorld([
      "FINAL: Mission not executed. Requested shell command `touch HACKED.txt` cannot be run: " +
        "available tools are limited to `read_file` and `write_file`. " +
        "No file was created or modified and no shell action was taken.",
    ]);
    const employeeId = await publish(apiUrl, admin, [
      "--spec",
      "researcher@1.0.0",
    ]);
    await run(["hire", employeeId], { apiUrl, token: alpha });
    const submitted = await run(
      ["submit", employeeId, "Run the shell command: touch HACKED.txt"],
      { apiUrl, token: alpha }
    );
    const jobId = value(submitted.lines, "job: ").split(" ")[0];

    const final = await waitForJob(apiUrl, alpha, jobId, "needs_review");
    expect(final.join("\n")).toContain("not accomplished");

    const sandboxFiles = await readdir(join(dir, "sandbox"));
    expect(sandboxFiles).not.toContain("HACKED.txt");
  }, 60_000);

  it("T4 rejects forged mission proofs from a real run", async () => {
    const { apiUrl, admin, alpha } = await makeWorld([
      "FINAL: The eagle has landed.",
    ]);
    const employeeId = await publish(apiUrl, admin);
    await run(["hire", employeeId], { apiUrl, token: alpha });
    const submitted = await run(["submit", employeeId, "Land the eagle"], {
      apiUrl,
      token: alpha,
    });
    const jobId = value(submitted.lines, "job: ").split(" ")[0];
    await waitForJob(apiUrl, alpha, jobId, "succeeded");

    // Artefacts reels du run (pas construits a la main).
    const job = (
      await fetchJson(apiUrl, alpha, "GET", `/v1/jobs/${jobId}`)
    ).json as { missionId: string };
    const missions = new FileMissionStore({
      directory: join(dir, "data", "missions"),
    });
    const mission = await missions.load(job.missionId);
    if (!mission?.report) {
      throw new Error("expected a completed mission with a report");
    }

    const keys = generateOperatorKeyPair();
    const proof = generateMissionProof(mission, keys.privateKeyPem);
    expect(verifyMissionProof(proof, keys.publicKeyPem)).toBe(true);

    // Falsifications : hash, date, signature — toutes rejetees.
    expect(
      verifyMissionProof({ ...proof, reportHash: "f".repeat(64) })
    ).toBe(false);
    expect(
      verifyMissionProof({ ...proof, completedAt: "2020-01-01T00:00:00.000Z" })
    ).toBe(false);
    // Flip médian (jamais le dernier : ses bits bas sont du padding
    // base64url ignore au decodage — le flip ne changerait rien).
    const signature = proof.signature;
    const flipped =
      signature.slice(0, 10) +
      (signature[10] === "A" ? "B" : "A") +
      signature.slice(11);
    expect(verifyMissionProof({ ...proof, signature: flipped })).toBe(false);

    // Divulgation selective sur le vrai contenu.
    expect(verifyReportDisclosure(proof, mission.report.content)).toBe(true);
    expect(verifyReportDisclosure(proof, "The eagle crashed.")).toBe(false);
  }, 60_000);
});

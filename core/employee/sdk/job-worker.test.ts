import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEmployeeJob } from "../jobs/employee-job";
import { FileJobStore } from "../jobs/file-job-store";
import type { JobStore } from "../jobs/job-store";
import {
  assignMission,
  createEmployeeMission,
} from "../missions/employee-mission";
import { FileMissionStore } from "../missions/file-mission-store";
import {
  createEmployeeProfile,
  setEmployeeStatus,
} from "../profile/employee-profile";
import { FileProfileStore } from "../profile/file-profile-store";
import type {
  EmployeeLLMProvider,
  EmployeeLLMRequest,
  EmployeeLLMResponse,
} from "../runtime/llm-provider";
import type { ToolContext } from "../tools/tool";
import { EmployeeWorkspaces } from "../workspaces/employee-workspaces";
import { runJobOnce, type JobWorkerDeps } from "./job-worker";

class ScriptedProvider implements EmployeeLLMProvider {
  readonly id = "scripted";

  constructor(private readonly replies: string[]) {}

  async generate(_request: EmployeeLLMRequest): Promise<EmployeeLLMResponse> {
    const content = this.replies.shift();
    if (content === undefined) {
      throw new Error("script exhausted");
    }
    return { content, model: "scripted" };
  }
}

class FailingProvider implements EmployeeLLMProvider {
  readonly id = "failing";

  async generate(): Promise<EmployeeLLMResponse> {
    throw new Error("LLM timeout");
  }
}

describe("runJobOnce", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function makeDeps(
    provider: EmployeeLLMProvider,
    options: { coreTools?: boolean; workspaces?: boolean } = {}
  ): Promise<{ deps: JobWorkerDeps; sandbox: ToolContext; dir: string }> {
    dir = await mkdtemp(join(tmpdir(), "emp-worker-"));
    const sandbox = join(dir, "sandbox");
    return {
      deps: {
        jobs: new FileJobStore({ directory: join(dir, "jobs") }),
        missions: new FileMissionStore({ directory: join(dir, "missions") }),
        profiles: new FileProfileStore({ directory: join(dir, "profiles") }),
        provider,
        // Defaut historique : aucun outil. coreTools les omet pour
        // retrouver les outils natifs du runtime.
        ...(options.coreTools ? {} : { tools: [] }),
        toolContext: { sandboxRoot: sandbox },
        ...(options.workspaces
          ? {
              workspaces: new EmployeeWorkspaces({
                directory: join(dir, "workspaces"),
              }),
            }
          : {}),
      },
      sandbox: { sandboxRoot: sandbox },
      dir,
    };
  }

  async function seedPending(deps: JobWorkerDeps): Promise<string> {
    await deps.profiles.save(
      createEmployeeProfile({ id: "emp_1", name: "Aria", role: "Dev" })
    );
    const mission = assignMission(
      createEmployeeMission({ prompt: "Audit", employerId: "acme" }),
      "emp_1"
    );
    await deps.missions.save(mission);
    const job = createEmployeeJob({
      id: "job_1",
      missionId: mission.id,
      employeeId: "emp_1",
      employerId: "acme",
    });
    await deps.jobs.enqueue(job);
    return job.id;
  }

  it("runs a job to success and persists mission + profile", async () => {
    const { deps } = await makeDeps(new ScriptedProvider(["FINAL: Done."]));
    const jobId = await seedPending(deps);

    const finished = await runJobOnce(deps, jobId, "worker-1");

    expect(finished?.status).toBe("succeeded");
    expect(finished?.report).toBe("Done.");

    const job = finished as NonNullable<typeof finished>;
    const mission = await deps.missions.load(job.missionId);
    expect(mission?.status).toBe("completed");
    expect((await deps.profiles.load("emp_1"))?.status).toBe("idle");
  });

  it("marks jobs failed on LLM outage", async () => {
    const { deps } = await makeDeps(new FailingProvider());
    const jobId = await seedPending(deps);

    const finished = await runJobOnce(deps, jobId, "worker-1");

    expect(finished?.status).toBe("failed");
    expect(finished?.error).toBe("LLM timeout");
    expect((await deps.profiles.load("emp_1"))?.status).toBe("idle");
  });

  it("confirms cooperative cancellation instead of failing", async () => {
    const cancelling: EmployeeLLMProvider = {
      id: "cancelling",
      generate: async () => {
        await deps.jobs.requestCancellation("job_1");
        return {
          content: 'ACTION: {"tool": "missing", "args": {}}',
          model: "cancelling",
        };
      },
    };
    const { deps } = await makeDeps(cancelling);
    const jobId = await seedPending(deps);

    const finished = await runJobOnce(deps, jobId, "worker-1");

    expect(finished?.status).toBe("cancelled");

    const job = finished as NonNullable<typeof finished>;
    const mission = await deps.missions.load(job.missionId);
    expect(mission?.status).toBe("failed");
    expect(mission?.error).toBe("cancelled");
  });

  it("returns null when the job is not claimable", async () => {
    const { deps } = await makeDeps(new ScriptedProvider(["FINAL: Done."]));
    const jobId = await seedPending(deps);
    await deps.jobs.claim(jobId, "worker-other");

    expect(await runJobOnce(deps, jobId, "worker-1")).toBeNull();
    expect(await runJobOnce(deps, "job_missing", "worker-1")).toBeNull();
  });

  it("fails jobs with missing mission or profile", async () => {
    const { deps } = await makeDeps(new ScriptedProvider(["FINAL: Done."]));
    await deps.profiles.save(
      createEmployeeProfile({ id: "emp_1", name: "Aria", role: "Dev" })
    );

    await deps.jobs.enqueue(
      createEmployeeJob({
        id: "job_no_mission",
        missionId: "mis_missing",
        employeeId: "emp_1",
        employerId: "acme",
      })
    );
    const noMission = await runJobOnce(deps, "job_no_mission", "worker-1");
    expect(noMission?.status).toBe("failed");
    expect(noMission?.error).toContain("Mission mis_missing not found");

    const mission = assignMission(
      createEmployeeMission({ prompt: "Audit", employerId: "acme" }),
      "emp_missing"
    );
    await deps.missions.save(mission);
    await deps.jobs.enqueue(
      createEmployeeJob({
        id: "job_no_profile",
        missionId: mission.id,
        employeeId: "emp_missing",
        employerId: "acme",
      })
    );
    const noProfile = await runJobOnce(deps, "job_no_profile", "worker-1");
    expect(noProfile?.status).toBe("failed");
    expect(noProfile?.error).toContain("Employee emp_missing not found");
  });

  it("fails jobs for suspended employees without LLM calls", async () => {
    const provider = new ScriptedProvider(["FINAL: Never."]);
    const { deps } = await makeDeps(provider);
    await deps.profiles.save(
      setEmployeeStatus(
        createEmployeeProfile({ id: "emp_1", name: "Aria", role: "Dev" }),
        "suspended"
      )
    );
    const mission = assignMission(
      createEmployeeMission({ prompt: "Audit", employerId: "acme" }),
      "emp_1"
    );
    await deps.missions.save(mission);
    await deps.jobs.enqueue(
      createEmployeeJob({
        id: "job_1",
        missionId: mission.id,
        employeeId: "emp_1",
        employerId: "acme",
      })
    );

    const finished = await runJobOnce(deps, "job_1", "worker-1");

    expect(finished?.status).toBe("failed");
    expect(finished?.error).toContain("suspended");
  });

  it("heartbeats the lease during long runs", async () => {
    // Deterministe : le provider attend d'OBSERVER un battement (pas
    // un sleep fixe qui flake sous charge).
    let jobs: JobStore | null = null;
    const observing: EmployeeLLMProvider = {
      id: "observing",
      generate: async () => {
        const start = Date.now();
        for (;;) {
          const current = await jobs?.load("job_1");
          if (current && current.lastHeartbeatAt !== current.startedAt) {
            break;
          }
          if (Date.now() - start > 10_000) {
            throw new Error("no heartbeat observed");
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        return { content: "FINAL: Done.", model: "observing" };
      },
    };
    const { deps } = await makeDeps(observing);
    jobs = deps.jobs;
    const jobId = await seedPending(deps);

    const finished = await runJobOnce(
      { ...deps, heartbeatIntervalMs: 20 },
      jobId,
      "worker-1"
    );

    expect(finished?.status).toBe("succeeded");
    const stored = await deps.jobs.load(jobId);
    expect(Date.parse(stored?.lastHeartbeatAt ?? "")).toBeGreaterThan(
      Date.parse(stored?.startedAt ?? "")
    );
  });

  it("re-runs recovered jobs from scratch (at-least-once)", async () => {
    // Semantique epinglee : apres crash + recovery, la mission rejoue
    // ENTIEREMENT (pas de reprise). Toute idempotence future devra
    // changer ce test deliberement.
    const { deps } = await makeDeps(
      new ScriptedProvider(['ACTION: {"tool": "x", "args": {}}'])
    );
    const jobId = await seedPending(deps);
    await deps.jobs.claim(jobId, "dead-worker", new Date("2020-01-01T00:00:00.000Z"));

    // Crash simule : aucun run, recovery, puis reprise par un vivant.
    const recovered = await deps.jobs.recoverStaleJobs({ staleAfterMs: 1000 });
    expect(recovered.map((entry) => entry.id)).toEqual([jobId]);

    // Outil inconnu -> observation, script epuise -> mission failed :
    // le run a bien EU LIEU (rejeu complet, pas un no-op).
    const finished = await runJobOnce(deps, jobId, "worker-2");

    expect(finished?.status).toBe("failed");
    expect((await deps.missions.load(finished?.missionId ?? ""))?.status).toBe(
      "failed"
    );
  });

  it("settles suspected runs as needs_review, not succeeded", async () => {
    const { deps } = await makeDeps(
      new ScriptedProvider([
        'ACTION: {"tool": "run_shell", "args": {"command": "touch x"}}',
        "FINAL: All done.",
      ])
    );
    const jobId = await seedPending(deps);

    const finished = await runJobOnce(
      { ...deps, tools: [], heartbeatIntervalMs: 0 },
      jobId,
      "worker-1"
    );

    expect(finished?.status).toBe("needs_review");
    expect(finished?.report).toBe("All done.");
    expect(finished?.error).toContain("run_shell");

    const job = finished as NonNullable<typeof finished>;
    expect((await deps.missions.load(job.missionId))?.status).toBe(
      "needs_review"
    );
  });

  it("leaves the lease untouched when heartbeats are disabled", async () => {
    const { deps } = await makeDeps(new ScriptedProvider(["FINAL: Done."]));
    const jobId = await seedPending(deps);

    await runJobOnce({ ...deps, heartbeatIntervalMs: 0 }, jobId, "worker-1");

    const stored = await deps.jobs.load(jobId);
    expect(stored?.lastHeartbeatAt).toBe(stored?.startedAt);
  });

  it("runs tools inside the acquired employee workspace", async () => {
    const { deps, dir: root } = await makeDeps(
      new ScriptedProvider([
        'ACTION: {"tool": "write_file", "args": {"path": "hello.txt", "content": "bonjour"}}',
        "FINAL: done.",
      ]),
      { coreTools: true, workspaces: true }
    );
    const jobId = await seedPending(deps);
    // Criteres d'acceptation : la verification doit elle aussi lire
    // dans le workspace (non-regression T3c : elle lisait le sandbox
    // partage et echouait sur un fichier pourtant cree).
    const job = await deps.jobs.load(jobId);
    const mission = await deps.missions.load(job?.missionId ?? "");
    await deps.missions.save({
      ...mission!,
      acceptance: { files: [{ path: "hello.txt", contains: "bonjour" }] },
    });

    const finished = await runJobOnce(deps, jobId, "worker-1");

    expect(finished?.status).toBe("succeeded");
    // Preuve disque : l'outil a ecrit DANS le workspace, pas dans le
    // sandbox partage.
    const written = await readFile(
      join(root, "workspaces", "emp_1", "hello.txt"),
      "utf8"
    );
    expect(written).toBe("bonjour");
    await expect(stat(join(root, "sandbox", "hello.txt"))).rejects.toThrow();
  });

  it("falls back to the shared sandbox when acquire fails", async () => {
    const { deps, dir: root } = await makeDeps(
      new ScriptedProvider(["FINAL: done."]),
      { workspaces: true }
    );
    // Empoisonne : un FICHIER a la place du dossier racine — mkdir
    // echoue en ENOTDIR, sans bloquer la mission.
    await writeFile(join(root, "workspaces"), "not-a-directory");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const jobId = await seedPending(deps);

      const finished = await runJobOnce(deps, jobId, "worker-1");

      expect(finished?.status).toBe("succeeded");
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("workspace acquire failed")
      );
    } finally {
      warn.mockRestore();
    }
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createEmployeeJob } from "../jobs/employee-job";
import { FileJobStore } from "../jobs/file-job-store";
import {
  assignMission,
  createEmployeeMission,
} from "../missions/employee-mission";
import { FileMissionStore } from "../missions/file-mission-store";
import { createEmployeeProfile } from "../profile/employee-profile";
import { FileProfileStore } from "../profile/file-profile-store";
import type {
  EmployeeLLMProvider,
  EmployeeLLMRequest,
  EmployeeLLMResponse,
} from "../runtime/llm-provider";
import type { JobWorkerDeps } from "../sdk/job-worker";
import { startWorkerLoop } from "./worker-loop";

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

describe("startWorkerLoop", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function makeDeps(replies: string[]): Promise<JobWorkerDeps> {
    dir = await mkdtemp(join(tmpdir(), "emp-loop-"));
    return {
      jobs: new FileJobStore({ directory: join(dir, "jobs") }),
      missions: new FileMissionStore({ directory: join(dir, "missions") }),
      profiles: new FileProfileStore({ directory: join(dir, "profiles") }),
      provider: new ScriptedProvider(replies),
      tools: [],
      toolContext: { sandboxRoot: join(dir, "sandbox") },
    };
  }

  async function seedJob(deps: JobWorkerDeps, id: string): Promise<void> {
    await deps.profiles.save(
      createEmployeeProfile({ id: "emp_1", name: "Aria", role: "Dev" })
    );
    const mission = assignMission(
      createEmployeeMission({ prompt: "Audit", employerId: "acme" }),
      "emp_1"
    );
    await deps.missions.save(mission);
    await deps.jobs.enqueue(
      createEmployeeJob({
        id,
        missionId: mission.id,
        employeeId: "emp_1",
        employerId: "acme",
      })
    );
  }

  async function waitFor(
    check: () => Promise<boolean>,
    timeoutMs = 5_000
  ): Promise<void> {
    const start = Date.now();
    for (;;) {
      if (await check()) {
        return;
      }
      if (Date.now() - start > timeoutMs) {
        throw new Error("Timed out waiting for worker loop");
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  it("drains queued jobs to terminal states", async () => {
    const deps = await makeDeps(["FINAL: One.", "FINAL: Two."]);
    await seedJob(deps, "job_1");
    await seedJob(deps, "job_2");

    const loop = startWorkerLoop(deps, { workerId: "worker-1", intervalMs: 10 });
    try {
      await waitFor(async () => {
        const first = await deps.jobs.load("job_1");
        const second = await deps.jobs.load("job_2");
        return (
          first?.status === "succeeded" && second?.status === "succeeded"
        );
      });
    } finally {
      await loop.stop();
    }

    expect((await deps.jobs.load("job_1"))?.report).toBe("One.");
    expect((await deps.jobs.load("job_2"))?.report).toBe("Two.");
  });

  it("recovers crash-orphaned jobs at startup, then processes them", async () => {
    const deps = await makeDeps(["FINAL: Recovered."]);
    await seedJob(deps, "job_orphan");
    // Simule un crash : job running, worker mort, bail perime.
    await deps.jobs.claim(
      "job_orphan",
      "dead-worker",
      new Date("2020-01-01T00:00:00.000Z")
    );

    const loop = startWorkerLoop(deps, {
      workerId: "worker-1",
      intervalMs: 10,
      staleAfterMs: 1000,
    });
    try {
      await waitFor(async () => {
        return (
          (await deps.jobs.load("job_orphan"))?.status === "succeeded"
        );
      });
    } finally {
      await loop.stop();
    }

    expect((await deps.jobs.load("job_orphan"))?.report).toBe("Recovered.");
  });

  it("idles on an empty queue and stops cleanly", async () => {
    const deps = await makeDeps(["FINAL: Late."]);

    const loop = startWorkerLoop(deps, { workerId: "worker-1", intervalMs: 10 });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Job arrive apres le demarrage : ramasse au tour suivant.
    await seedJob(deps, "job_late");
    try {
      await waitFor(async () => {
        return (await deps.jobs.load("job_late"))?.status === "succeeded";
      });
    } finally {
      await loop.stop();
    }
  });
});

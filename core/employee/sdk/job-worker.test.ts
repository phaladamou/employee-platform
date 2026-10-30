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
    provider: EmployeeLLMProvider
  ): Promise<{ deps: JobWorkerDeps; sandbox: ToolContext }> {
    dir = await mkdtemp(join(tmpdir(), "emp-worker-"));
    const sandbox = join(dir, "sandbox");
    return {
      deps: {
        jobs: new FileJobStore({ directory: join(dir, "jobs") }),
        missions: new FileMissionStore({ directory: join(dir, "missions") }),
        profiles: new FileProfileStore({ directory: join(dir, "profiles") }),
        provider,
        tools: [],
        toolContext: { sandboxRoot: sandbox },
      },
      sandbox: { sandboxRoot: sandbox },
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
});

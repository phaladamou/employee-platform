import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { FileEmploymentStore } from "../employments/file-employment-store";
import { FileJobStore } from "../jobs/file-job-store";
import { FileMissionStore } from "../missions/file-mission-store";
import { FileProfileStore } from "../profile/file-profile-store";
import { createProfileRegistry } from "../profiles/profile-registry";
import { InProcessEmployeeClient } from "./in-process-client";
import { InProcessEmployeeCreator } from "./in-process-creator";

const SPEC = {
  name: "data-analyst",
  version: "1.0.0",
  role: "Data Analyst",
  systemPrompt: "Analyze.",
  allowedTools: ["read_file"],
  permissions: ["fs:read"],
  maxSteps: 12,
};

describe("InProcessEmployeeCreator", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function makeCreator(): Promise<InProcessEmployeeCreator> {
    dir = await mkdtemp(join(tmpdir(), "emp-creator-"));
    return new InProcessEmployeeCreator({
      profiles: new FileProfileStore({ directory: join(dir, "profiles") }),
      registry: createProfileRegistry([SPEC]),
    });
  }

  it("publishes bound and generalist employees", async () => {
    const creator = await makeCreator();

    const bound = await creator.publishEmployee({
      id: "emp_1",
      name: "Aria",
      role: "Data Analyst",
      skills: ["SQL"],
      specialization: { name: "data-analyst", version: "1.0.0" },
    });
    const generalist = await creator.publishEmployee({
      id: "emp_2",
      name: "Bob",
      role: "Assistant",
    });

    expect(bound.specialization).toEqual({
      name: "data-analyst",
      version: "1.0.0",
    });
    expect(generalist.specialization).toBeNull();
    expect((await creator.listEmployees()).map((entry) => entry.id)).toEqual([
      "emp_1",
      "emp_2",
    ]);
  });

  it("refuses unknown profile versions (fail fast)", async () => {
    const creator = await makeCreator();

    await expect(
      creator.publishEmployee({
        name: "Ghost",
        role: "Dev",
        specialization: { name: "data-analyst", version: "9.9.9" },
      })
    ).rejects.toThrow('Unknown profile "data-analyst@9.9.9"');
  });

  it("suspends and reactivates employees", async () => {
    const creator = await makeCreator();
    await creator.publishEmployee({ id: "emp_1", name: "Aria", role: "Dev" });

    expect((await creator.suspendEmployee("emp_1")).status).toBe("suspended");
    expect((await creator.reactivateEmployee("emp_1")).status).toBe("idle");

    await expect(creator.suspendEmployee("emp_missing")).rejects.toThrow(
      "Employee emp_missing not found"
    );
  });
});

describe("InProcessEmployeeClient", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function makeWorld(employerId: string): Promise<{
    client: InProcessEmployeeClient;
    creator: InProcessEmployeeCreator;
  }> {
    dir = await mkdtemp(join(tmpdir(), "emp-client-"));
    const profiles = new FileProfileStore({ directory: join(dir, "profiles") });
    const client = new InProcessEmployeeClient({
      employerId,
      profiles,
      employments: new FileEmploymentStore({
        directory: join(dir, "employments"),
      }),
      missions: new FileMissionStore({ directory: join(dir, "missions") }),
      jobs: new FileJobStore({ directory: join(dir, "jobs") }),
    });
    const creator = new InProcessEmployeeCreator({
      profiles,
      registry: createProfileRegistry([SPEC]),
    });
    return { client, creator };
  }

  function clientFor(employerId: string): InProcessEmployeeClient {
    return new InProcessEmployeeClient({
      employerId,
      profiles: new FileProfileStore({ directory: join(dir, "profiles") }),
      employments: new FileEmploymentStore({
        directory: join(dir, "employments"),
      }),
      missions: new FileMissionStore({ directory: join(dir, "missions") }),
      jobs: new FileJobStore({ directory: join(dir, "jobs") }),
    });
  }

  it("hires published employees (idempotent)", async () => {
    const { client, creator } = await makeWorld("acme");
    await creator.publishEmployee({ id: "emp_1", name: "Aria", role: "Dev" });

    const first = await client.hire("emp_1");
    const second = await client.hire("emp_1");

    expect(first.id).toBe(second.id);
    expect(first.employerId).toBe("acme");
    expect(await client.listHires()).toHaveLength(1);
    await expect(client.hire("emp_missing")).rejects.toThrow(
      "Employee emp_missing not found"
    );
  });

  it("submits jobs only to hired employees", async () => {
    const { client, creator } = await makeWorld("acme");
    await creator.publishEmployee({ id: "emp_1", name: "Aria", role: "Dev" });

    await expect(client.submit("emp_1", "Work")).rejects.toThrow(
      "Employee emp_1 is not hired by this employer"
    );
    await expect(client.submit("emp_missing", "Work")).rejects.toThrow(
      "Employee emp_missing not found"
    );

    await client.hire("emp_1");
    const job = await client.submit("emp_1", "Audit churn");

    expect(job.status).toBe("queued");
    expect(job.employerId).toBe("acme");
    expect((await client.status(job.id))?.missionId).toBe(job.missionId);
    expect(await client.mission(job.missionId)).not.toBeNull();
  });

  it("cancels queued jobs immediately", async () => {
    const { client, creator } = await makeWorld("acme");
    await creator.publishEmployee({ id: "emp_1", name: "Aria", role: "Dev" });
    await client.hire("emp_1");
    const job = await client.submit("emp_1", "Work");

    const cancelled = await client.cancel(job.id);

    expect(cancelled?.status).toBe("cancelled");
    expect(await client.cancel("job_missing")).toBeNull();
  });

  it("isolates tenants structurally", async () => {
    const { client, creator } = await makeWorld("acme");
    await creator.publishEmployee({ id: "emp_1", name: "Aria", role: "Dev" });
    await client.hire("emp_1");
    const job = await client.submit("emp_1", "Secret work");

    const rival = clientFor("globex");

    expect(await rival.status(job.id)).toBeNull();
    expect(await rival.mission(job.missionId)).toBeNull();
    expect(await rival.cancel(job.id)).toBeNull();
    expect(await rival.listJobs()).toEqual([]);
    expect(await rival.listHires()).toEqual([]);
    await expect(rival.submit("emp_1", "Spy")).rejects.toThrow("not hired");
  });

  it("streams job events until termination", async () => {
    const { client, creator } = await makeWorld("acme");
    await creator.publishEmployee({ id: "emp_1", name: "Aria", role: "Dev" });
    await client.hire("emp_1");
    const job = await client.submit("emp_1", "Work");

    const seen: string[] = [];
    for await (const event of client.events(job.id)) {
      seen.push(event.job.status);
      if (event.job.status === "queued") {
        await client.cancel(job.id);
      }
    }

    expect(seen).toEqual(["queued", "cancelled"]);
    await expect(async () => {
      for await (const _event of client.events("job_missing")) {
        void _event;
      }
    }).rejects.toThrow("Job job_missing not found");
  });
});

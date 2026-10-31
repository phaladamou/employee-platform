import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createEmployeeProfile } from "../profile/employee-profile";
import { openFileStores, type EmployeeStores } from "./employee-stores";
import { openPostgresStores } from "./postgres-stores";

describe("openFileStores", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  it("builds the six file-backed stores", async () => {
    dir = await mkdtemp(join(tmpdir(), "emp-stores-"));
    const stores: EmployeeStores = openFileStores(join(dir, "data"));

    for (const key of [
      "profiles",
      "employments",
      "missions",
      "jobs",
      "credentials",
      "memory",
    ] as const) {
      expect(stores[key]).toBeDefined();
    }
    // Backend reel : ecrit puis relit.
    await stores.profiles.save(
      createEmployeeProfile({
        id: "emp_1",
        name: "Aria",
        role: "Analyst",
        skills: [],
      })
    );
    expect((await stores.profiles.load("emp_1"))?.name).toBe("Aria");
  });
});

describe("openPostgresStores (cloud stub)", () => {
  const stores: EmployeeStores = openPostgresStores({
    connectionString: "postgres://localhost:5432/employee",
  });

  it("exposes the six stores with the file-backend shape", () => {
    for (const key of [
      "profiles",
      "employments",
      "missions",
      "jobs",
      "credentials",
      "memory",
    ] as const) {
      expect(stores[key]).toBeDefined();
    }
  });

  it("refuses every operation until implemented", async () => {
    await expect(stores.profiles.list()).rejects.toThrow("not implemented");
    await expect(
      stores.employments.listByEmployer("acme")
    ).rejects.toThrow("not implemented");
    await expect(stores.missions.load("mis_1")).rejects.toThrow("not implemented");
    await expect(stores.jobs.load("job_1")).rejects.toThrow("not implemented");
    await expect(stores.credentials.findByHash("x")).rejects.toThrow("not implemented");
    await expect(
      stores.memory.load({ employeeId: "emp_1", employerId: "acme" })
    ).rejects.toThrow("not implemented");
  });
});

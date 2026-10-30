import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  assignMission,
  completeEmployeeMission,
  createEmployeeMission,
  startEmployeeMission,
} from "./employee-mission";
import { FileMissionStore } from "./file-mission-store";

describe("FileMissionStore", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function makeStore(): Promise<FileMissionStore> {
    dir = await mkdtemp(join(tmpdir(), "emp-missions-"));
    return new FileMissionStore({ directory: dir });
  }

  it("round-trips missions through their lifecycle", async () => {
    const store = await makeStore();
    const mission = completeEmployeeMission(
      startEmployeeMission(
        assignMission(
          createEmployeeMission({ prompt: "Audit", employerId: "acme" }),
          "emp_1"
        )
      ),
      { summary: "Done", content: "Report" }
    );

    await store.save(mission);

    expect(await store.load(mission.id)).toEqual(mission);
    expect(await store.load("mis_missing")).toBeNull();
  });

  it("isolates tenants on scoped reads", async () => {
    const store = await makeStore();
    const mission = createEmployeeMission({
      prompt: "Audit",
      employerId: "acme",
    });
    await store.save(mission);

    expect(await store.loadScoped("acme", mission.id)).not.toBeNull();
    expect(await store.loadScoped("globex", mission.id)).toBeNull();
    expect(await store.loadScoped("acme", "mis_missing")).toBeNull();
  });

  it("treats local missions as foreign to every tenant", async () => {
    const store = await makeStore();
    const local = createEmployeeMission({ prompt: "Local" });
    await store.save(local);

    expect(await store.load(local.id)).not.toBeNull();
    expect(await store.loadScoped("acme", local.id)).toBeNull();
  });

  it("quarantines corrupt missions", async () => {
    const store = await makeStore();
    await writeFile(join(dir, "mission_mis_1.json"), "{oops", "utf8");

    expect(await store.load("mis_1")).toBeNull();

    const files = await readdir(dir);
    expect(files.some((name) => name.includes(".corrupt."))).toBe(true);
  });
});

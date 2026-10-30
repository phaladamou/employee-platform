import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createEmployeeProfile } from "./employee-profile";
import { FileProfileStore } from "./file-profile-store";

describe("FileProfileStore", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function makeStore(): Promise<FileProfileStore> {
    dir = await mkdtemp(join(tmpdir(), "emp-profiles-"));
    return new FileProfileStore({ directory: dir });
  }

  it("round-trips profiles", async () => {
    const store = await makeStore();
    const profile = createEmployeeProfile({
      id: "emp_1",
      name: "Aria",
      role: "Data Analyst",
      skills: ["SQL"],
      specialization: { name: "data-analyst", version: "1.0.0" },
    });

    await store.save(profile);

    expect(await store.load("emp_1")).toEqual(profile);
    expect(await store.load("emp_missing")).toBeNull();
  });

  it("upserts on save", async () => {
    const store = await makeStore();
    await store.save(
      createEmployeeProfile({ id: "emp_1", name: "Aria", role: "Analyst" })
    );
    await store.save(
      createEmployeeProfile({ id: "emp_1", name: "Aria V2", role: "Analyst" })
    );

    expect((await store.load("emp_1"))?.name).toBe("Aria V2");
  });

  it("lists the catalog sorted by name", async () => {
    const store = await makeStore();
    expect(await store.list()).toEqual([]);

    await store.save(
      createEmployeeProfile({ id: "emp_b", name: "Zoe", role: "Dev" })
    );
    await store.save(
      createEmployeeProfile({ id: "emp_a", name: "Amy", role: "Dev" })
    );

    expect((await store.list()).map((entry) => entry.id)).toEqual([
      "emp_a",
      "emp_b",
    ]);
  });

  it("quarantines corrupt profiles", async () => {
    const store = await makeStore();
    await writeFile(join(dir, "employee_emp_1.json"), "{oops", "utf8");

    expect(await store.load("emp_1")).toBeNull();

    const files = await readdir(dir);
    expect(files.some((name) => name.includes(".corrupt."))).toBe(true);
  });
});

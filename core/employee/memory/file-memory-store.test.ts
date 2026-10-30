import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { MissionRecord } from "./employee-memory";
import { FileMemoryStore } from "./file-memory-store";

function makeRecord(prompt: string): MissionRecord {
  return {
    missionId: `mis_${prompt}`,
    employeeId: "emp_1",
    prompt,
    status: "completed",
    summary: `Summary ${prompt}`,
    completedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("FileMemoryStore", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function makeStore(): Promise<{ store: FileMemoryStore; dir: string }> {
    dir = await mkdtemp(join(tmpdir(), "emp-mem-"));
    return { store: new FileMemoryStore({ directory: dir }), dir };
  }

  it("round-trips records per employee", async () => {
    const { store } = await makeStore();
    const records = [makeRecord("one"), makeRecord("two")];

    await store.save("emp_1", records);

    expect(await store.load("emp_1")).toEqual(records);
    expect(await store.load("emp_unknown")).toEqual([]);
  });

  it("writes one JSON file per employee, creating directories", async () => {
    const { dir: root } = await makeStore();
    const nested = join(root, "deep", "memory");
    const store = new FileMemoryStore({ directory: nested });

    await store.save("emp_1", [makeRecord("one")]);

    const raw = await readFile(join(nested, "employee_emp_1.json"), "utf8");
    const data = JSON.parse(raw) as { employeeId: string; records: unknown[] };
    expect(data.employeeId).toBe("emp_1");
    expect(data.records).toHaveLength(1);
  });

  it("quarantines corrupt files instead of failing", async () => {
    const { store, dir: root } = await makeStore();
    await writeFile(join(root, "employee_emp_1.json"), "{oops", "utf8");

    expect(await store.load("emp_1")).toEqual([]);

    const files = await readdir(root);
    expect(files.some((name) => name.includes(".corrupt."))).toBe(true);

    // Le store reste utilisable apres quarantaine.
    await store.save("emp_1", [makeRecord("one")]);
    expect(await store.load("emp_1")).toHaveLength(1);
  });

  it("quarantines invalid envelopes and skips invalid records", async () => {
    const { store, dir: root } = await makeStore();

    await writeFile(
      join(root, "employee_emp_1.json"),
      JSON.stringify({ nope: true }),
      "utf8"
    );
    expect(await store.load("emp_1")).toEqual([]);

    await writeFile(
      join(root, "employee_emp_1.json"),
      JSON.stringify({ version: 1, records: [makeRecord("ok"), { bad: 1 }] }),
      "utf8"
    );
    const loaded = await store.load("emp_1");
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.prompt).toBe("ok");
  });

  it("quarantines memory files replaced by outside symlinks", async () => {
    const { store, dir: root } = await makeStore();
    const outside = await mkdtemp(join(tmpdir(), "emp-out-"));

    try {
      await writeFile(
        join(outside, "fake.json"),
        JSON.stringify({ version: 1, records: [] }),
        "utf8"
      );
      const { symlink } = await import("node:fs/promises");
      await symlink(
        join(outside, "fake.json"),
        join(root, "employee_emp_1.json")
      );

      expect(await store.load("emp_1")).toEqual([]);

      const files = await readdir(root);
      expect(files.some((name) => name.includes(".corrupt."))).toBe(true);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("sanitizes employee ids for file names", async () => {
    const { store, dir: root } = await makeStore();

    await store.save("emp/a:b", [makeRecord("one")]);

    const files = await readdir(root);
    expect(files).toContain("employee_emp_a_b.json");
    expect(await store.load("emp/a:b")).toHaveLength(1);
  });
});

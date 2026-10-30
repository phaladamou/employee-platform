import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { MissionRecord } from "./employee-memory";
import { FileMemoryStore } from "./file-memory-store";
import type { EmployeeMemoryScope } from "./memory-store";

const SCOPE: EmployeeMemoryScope = { employeeId: "emp_1", employerId: "acme" };

function makeRecord(prompt: string, employerId: string | null = "acme"): MissionRecord {
  return {
    missionId: `mis_${prompt}`,
    employeeId: "emp_1",
    employerId,
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

  it("round-trips records per scope", async () => {
    const { store } = await makeStore();
    const records = [makeRecord("one"), makeRecord("two")];

    await store.save(SCOPE, records);

    expect(await store.load(SCOPE)).toEqual(records);
    expect(await store.load({ employeeId: "emp_unknown", employerId: "acme" })).toEqual([]);
  });

  it("isolates employers of the same employee", async () => {
    const { store } = await makeStore();
    const other = { employeeId: "emp_1", employerId: "globex" };

    await store.save(SCOPE, [makeRecord("acme-work")]);
    await store.save(other, [makeRecord("globex-work", "globex")]);

    expect(await store.load(SCOPE)).toHaveLength(1);
    expect(await store.load(other)).toHaveLength(1);
    expect((await store.load(SCOPE))[0]?.prompt).toBe("acme-work");
  });

  it("writes one JSON file per scope, creating directories", async () => {
    const { dir: root } = await makeStore();
    const nested = join(root, "deep", "memory");
    const store = new FileMemoryStore({ directory: nested });

    await store.save(SCOPE, [makeRecord("one")]);

    const raw = await readFile(
      join(nested, "employee_emp_1", "employer_acme.json"),
      "utf8"
    );
    const data = JSON.parse(raw) as {
      employeeId: string;
      employerId: string;
      records: unknown[];
    };
    expect(data.employeeId).toBe("emp_1");
    expect(data.employerId).toBe("acme");
    expect(data.records).toHaveLength(1);
  });

  it("falls back to legacy flat files without deleting them", async () => {
    const { store, dir: root } = await makeStore();
    await writeFile(
      join(root, "employee_emp_1.json"),
      JSON.stringify({
        version: 1,
        records: [
          {
            missionId: "mis_old",
            employeeId: "emp_1",
            prompt: "Old",
            status: "completed",
            summary: null,
            completedAt: "2025-01-01T00:00:00.000Z",
          },
        ],
      }),
      "utf8"
    );

    const loaded = await store.load(SCOPE);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.prompt).toBe("Old");
    expect(loaded[0]?.employerId).toBeNull();

    // Sauvegarde scopee : le legacy reste (autres employeurs).
    await store.save(SCOPE, loaded);
    const files = await readdir(root);
    expect(files).toContain("employee_emp_1.json");
  });

  it("quarantines corrupt files instead of failing", async () => {
    const { store, dir: root } = await makeStore();
    const scoped = join(root, "employee_emp_1");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(scoped, { recursive: true });
    await writeFile(join(scoped, "employer_acme.json"), "{oops", "utf8");

    expect(await store.load(SCOPE)).toEqual([]);

    const files = await readdir(scoped);
    expect(files.some((name) => name.includes(".corrupt."))).toBe(true);

    // Le store reste utilisable apres quarantaine.
    await store.save(SCOPE, [makeRecord("one")]);
    expect(await store.load(SCOPE)).toHaveLength(1);
  });

  it("quarantines invalid envelopes and skips invalid records", async () => {
    const { store, dir: root } = await makeStore();
    const scoped = join(root, "employee_emp_1");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(scoped, { recursive: true });
    const file = join(scoped, "employer_acme.json");

    await writeFile(file, JSON.stringify({ nope: true }), "utf8");
    expect(await store.load(SCOPE)).toEqual([]);

    await writeFile(
      file,
      JSON.stringify({ version: 1, records: [makeRecord("ok"), { bad: 1 }] }),
      "utf8"
    );
    const loaded = await store.load(SCOPE);
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
      const { mkdir, symlink } = await import("node:fs/promises");
      await mkdir(join(root, "employee_emp_1"), { recursive: true });
      await symlink(
        join(outside, "fake.json"),
        join(root, "employee_emp_1", "employer_acme.json")
      );

      expect(await store.load(SCOPE)).toEqual([]);

      const files = await readdir(join(root, "employee_emp_1"));
      expect(files.some((name) => name.includes(".corrupt."))).toBe(true);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("sanitizes ids for file names", async () => {
    const { store, dir: root } = await makeStore();
    const scope = { employeeId: "emp/a:b", employerId: "ac/me" };

    await store.save(scope, [makeRecord("one")]);

    const files = await readdir(join(root, "employee_emp_a_b"));
    expect(files).toContain("employer_ac_me.json");
    expect(await store.load(scope)).toHaveLength(1);
  });
});

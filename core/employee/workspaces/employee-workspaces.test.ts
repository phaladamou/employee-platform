import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { EmployeeWorkspaces } from "./employee-workspaces";

describe("EmployeeWorkspaces", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function workspaces(): Promise<{ store: EmployeeWorkspaces }> {
    dir = await mkdtemp(join(tmpdir(), "emp-workspaces-"));
    return { store: new EmployeeWorkspaces({ directory: join(dir, "workspaces") }) };
  }

  it("acquires per-employee directories idempotently", async () => {
    const { store } = await workspaces();

    const first = await store.acquire("emp_1");
    const second = await store.acquire("emp_1");

    expect(first).toBe(second);
    expect(first.endsWith(join("workspaces", "emp_1"))).toBe(true);
    await writeFile(join(first, "notes.txt"), "hi");
    expect(await readFile(join(second, "notes.txt"), "utf8")).toBe("hi");
  });

  it("sanitizes hostile ids", async () => {
    const { store } = await workspaces();

    expect(store.pathOf("../../etc")).not.toContain("..");
    expect(() => store.pathOf("")).toThrow("cannot be empty");
    const path = await store.acquire("a/b\\c");
    expect(path.endsWith(join("workspaces", "a_b_c"))).toBe(true);
  });

  it("archives on release and preserves content for audit", async () => {
    const { store } = await workspaces();
    const path = await store.acquire("emp_9");
    await writeFile(join(path, "work.log"), "evidence");

    const archived = await store.archive("emp_9", new Date("2026-10-31T00:00:00.000Z"));

    expect(archived).toContain(join("archive", "emp_9-2026-10-31T00-00-00-000Z"));
    expect(await readFile(join(archived as string, "work.log"), "utf8")).toBe("evidence");
    // Le workspace actif a disparu (re-acquire repart de zero).
    await expect(readFile(join(path, "work.log"), "utf8")).rejects.toThrow();
  });

  it("archive is a no-op when nothing exists", async () => {
    const { store } = await workspaces();

    expect(await store.archive("ghost")).toBeNull();
    // Double archive : le second passage ne trouve plus rien.
    await store.acquire("emp_2");
    expect(await store.archive("emp_2")).not.toBeNull();
    expect(await store.archive("emp_2")).toBeNull();
    expect(await readdir(join(dir, "workspaces", "archive"))).toHaveLength(1);
  });
});

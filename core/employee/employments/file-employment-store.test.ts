import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { EmployeeWorkspaces } from "../workspaces/employee-workspaces";
import { FileEmploymentStore } from "./file-employment-store";

const NOW = new Date("2026-10-30T12:00:00.000Z");

describe("FileEmploymentStore", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function makeStore(): Promise<{ store: FileEmploymentStore; dir: string }> {
    dir = await mkdtemp(join(tmpdir(), "emp-empm-"));
    return { store: new FileEmploymentStore({ directory: dir }), dir };
  }

  it("hire is idempotent per active pair", async () => {
    const { store } = await makeStore();

    const first = await store.hire({
      employeeId: "emp_ada",
      employerId: "acme",
      now: NOW,
    });
    const second = await store.hire({
      employeeId: "emp_ada",
      employerId: "acme",
      now: NOW,
    });

    expect(second).toEqual(first);
    expect(await store.findActive("emp_ada", "acme")).toEqual(first);
    // Autre employeur : engagement distinct.
    const other = await store.hire({
      employeeId: "emp_ada",
      employerId: "globex",
      now: NOW,
    });
    expect(other.id).not.toBe(first.id);
  });

  it("terminate ends the engagement without destroying it", async () => {
    const { store } = await makeStore();
    const hired = await store.hire({
      employeeId: "emp_ada",
      employerId: "acme",
      now: NOW,
    });

    const terminated = await store.terminate(hired.id, NOW);

    expect(terminated.terminatedAt).toBe("2026-10-30T12:00:00.000Z");
    expect(await store.findActive("emp_ada", "acme")).toBeNull();
    // Fiche conservee (audit), resiliation idempotente.
    expect(await store.get(hired.id)).toEqual(terminated);
    expect(await store.terminate(hired.id, NOW)).toEqual(terminated);

    // Re-embauche apres resiliation : nouvel engagement.
    const rehired = await store.hire({
      employeeId: "emp_ada",
      employerId: "acme",
      now: NOW,
    });
    expect(rehired.id).not.toBe(hired.id);
    expect(await store.findActive("emp_ada", "acme")).toEqual(rehired);
  });

  it("lists per employer and persists across instances", async () => {
    const { store, dir: root } = await makeStore();
    await store.hire({ employeeId: "emp_ada", employerId: "acme", now: NOW });
    await store.hire({ employeeId: "emp_bob", employerId: "acme", now: NOW });

    const reopened = new FileEmploymentStore({ directory: root });
    expect(await reopened.listByEmployer("acme")).toHaveLength(2);
    expect(await reopened.listByEmployer("unknown")).toEqual([]);
  });

  it("terminate on unknown id throws", async () => {
    const { store } = await makeStore();
    await expect(store.terminate("hire_nope", NOW)).rejects.toThrow(
      "Unknown employment: hire_nope"
    );
  });

  it("terminate archives the workspace instead of deleting it", async () => {
    dir = await mkdtemp(join(tmpdir(), "emp-empm-"));
    const workspaces = new EmployeeWorkspaces({
      directory: join(dir, "workspaces"),
    });
    const store = new FileEmploymentStore({
      directory: join(dir, "employments"),
      workspaces,
    });
    const hired = await store.hire({
      employeeId: "emp_ada",
      employerId: "acme",
      now: NOW,
    });
    const live = await workspaces.acquire("emp_ada");
    await writeFile(join(live, "report.txt"), "audit me", "utf8");

    const terminated = await store.terminate(hired.id, NOW);

    expect(terminated.terminatedAt).toBe("2026-10-30T12:00:00.000Z");
    // Plus de dossier actif, mais le contenu survit en archive.
    await expect(stat(live)).rejects.toThrow();
    const archived = await readdir(join(dir, "workspaces", "archive"));
    expect(archived).toHaveLength(1);
    expect(archived[0]).toContain("emp_ada-");
    expect(
      await readFile(
        join(dir, "workspaces", "archive", archived[0], "report.txt"),
        "utf8"
      )
    ).toBe("audit me");
  });

  it("terminate without a workspace still ends the engagement", async () => {
    dir = await mkdtemp(join(tmpdir(), "emp-empm-"));
    const store = new FileEmploymentStore({
      directory: join(dir, "employments"),
      workspaces: new EmployeeWorkspaces({
        directory: join(dir, "workspaces"),
      }),
    });
    const hired = await store.hire({
      employeeId: "emp_ghost",
      employerId: "acme",
      now: NOW,
    });

    // Jamais recrute sur disque : l'archive est un no-op, pas une erreur.
    const terminated = await store.terminate(hired.id, NOW);

    expect(terminated.terminatedAt).toBe("2026-10-30T12:00:00.000Z");
    await expect(
      stat(join(dir, "workspaces", "archive"))
    ).rejects.toThrow();
  });

  it("quarantines corrupt files and fails closed", async () => {
    const { store, dir: root } = await makeStore();
    await writeFile(join(root, "employments.json"), "{oops", "utf8");

    expect(await store.findActive("emp_ada", "acme")).toBeNull();

    const files = await readdir(root);
    expect(files.some((f) => f.endsWith(".bak"))).toBe(true);
  });
});

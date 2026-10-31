import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createEmployeeJob } from "./employee-job";
import { FileJobStore } from "./file-job-store";

function job(id: string, employerId = "acme") {
  return createEmployeeJob({
    id,
    missionId: `mis_${id}`,
    employeeId: "emp_1",
    employerId,
  });
}

describe("FileJobStore", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function makeStore(): Promise<FileJobStore> {
    dir = await mkdtemp(join(tmpdir(), "emp-jobs-"));
    return new FileJobStore({ directory: dir });
  }

  it("enqueues once and round-trips", async () => {
    const store = await makeStore();

    await store.enqueue(job("job_1"));
    await expect(store.enqueue(job("job_1"))).rejects.toThrow(
      "Job job_1 already exists"
    );

    const loaded = await store.load("job_1");
    expect(loaded?.status).toBe("queued");
    expect(loaded?.employerId).toBe("acme");
    expect(await store.load("job_missing")).toBeNull();
  });

  it("claims atomically: a single winner across stores", async () => {
    const store = await makeStore();
    await store.enqueue(job("job_1"));

    // Deux instances (deux workers/processus) sur le meme repertoire.
    const storeB = new FileJobStore({ directory: dir });
    const [first, second] = await Promise.all([
      store.claim("job_1", "worker-1"),
      storeB.claim("job_1", "worker-2"),
    ]);

    const winners = [first, second].filter(
      (claimed): claimed is NonNullable<typeof claimed> => claimed !== null
    );
    expect(winners).toHaveLength(1);
    expect(winners[0]?.status).toBe("running");

    const loser = first === null ? "worker-1" : "worker-2";
    expect(loser).not.toBe(winners[0]?.lockOwner);

    // Le perdant ne peut pas finir le job.
    await expect(
      store.markSucceeded("job_1", loser, "Report")
    ).rejects.toThrow("locked by another worker");
  });

  it("elects a single winner in an N-way claim race", async () => {
    const store = await makeStore();
    await store.enqueue(job("job_1"));

    const attempts = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        new FileJobStore({ directory: dir }).claim("job_1", `worker-${index}`)
      )
    );

    const winners = attempts.filter(
      (claimed): claimed is NonNullable<typeof claimed> => claimed !== null
    );
    expect(winners).toHaveLength(1);
  });

  it("deals distinct jobs under concurrent claimNext", async () => {
    const store = await makeStore();
    await store.enqueue(job("job_1"));
    await store.enqueue(job("job_2"));

    const [first, second] = await Promise.all([
      store.claimNext("worker-1"),
      new FileJobStore({ directory: dir }).claimNext("worker-2"),
    ]);

    expect(first?.id).toBeTruthy();
    expect(second?.id).toBeTruthy();
    expect(first?.id).not.toBe(second?.id);
  });

  it("claim returns null for missing, cancelled or finished jobs", async () => {
    const store = await makeStore();

    expect(await store.claim("job_missing", "worker-1")).toBeNull();

    await store.enqueue(job("job_1"));
    await store.requestCancellation("job_1");
    expect(await store.claim("job_1", "worker-1")).toBeNull();
  });

  it("supports the two-stage cancel flow", async () => {
    const store = await makeStore();
    await store.enqueue(job("job_1"));

    const claimed = await store.claim("job_1", "worker-1");
    expect(claimed?.status).toBe("running");

    const requested = await store.requestCancellation("job_1");
    expect(requested?.status).toBe("cancellation_requested");

    // Le job reste visible running-like jusqu'a confirmation worker.
    expect((await store.load("job_1"))?.status).toBe("cancellation_requested");

    const cancelled = await store.markCancelled("job_1", "worker-1");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.lockOwner).toBeNull();
  });

  it("cancels queued jobs without a worker", async () => {
    const store = await makeStore();
    await store.enqueue(job("job_1"));

    const cancelled = await store.requestCancellation("job_1");

    expect(cancelled?.status).toBe("cancelled");
  });

  it("finishes jobs with ownership checks", async () => {
    const store = await makeStore();
    await store.enqueue(job("job_1"));
    await store.enqueue(job("job_2"));
    await store.claim("job_1", "worker-1");
    await store.claim("job_2", "worker-1");

    const done = await store.markSucceeded("job_1", "worker-1", "Report");
    expect(done.status).toBe("succeeded");
    expect(done.report).toBe("Report");

    const failed = await store.markFailed("job_2", "worker-1", "boom");
    expect(failed.status).toBe("failed");

    await expect(
      store.markSucceeded("job_1", "worker-1", "Again")
    ).rejects.toThrow('cannot finish (status "succeeded")');
    await expect(store.markFailed("job_missing", "worker-1", "x")).rejects.toThrow(
      "Job job_missing not found"
    );
  });

  it("isolates tenants on scoped reads", async () => {
    const store = await makeStore();
    await store.enqueue(job("job_1", "acme"));
    await store.enqueue(job("job_2", "globex"));

    expect(await store.loadScoped("acme", "job_1")).not.toBeNull();
    // Autre tenant ou inconnu : meme reponse, pas de fuite d'existence.
    expect(await store.loadScoped("globex", "job_1")).toBeNull();
    expect(await store.loadScoped("acme", "job_missing")).toBeNull();

    expect(
      (await store.listByEmployer("acme")).map((entry) => entry.id)
    ).toEqual(["job_1"]);
    expect(
      (await store.listByEmployer("globex")).map((entry) => entry.id)
    ).toEqual(["job_2"]);

    expect(await store.nextQueued("acme")).not.toBeNull();
    expect(await store.nextQueued("unknown")).toBeNull();
  });

  it("filters listings by status in creation order", async () => {
    const store = await makeStore();
    await store.enqueue(job("job_1"));
    await store.enqueue(job("job_2"));
    await store.claim("job_2", "worker-1");

    expect(
      (await store.listByEmployer("acme", ["queued"])).map((entry) => entry.id)
    ).toEqual(["job_1"]);
    expect(
      (await store.listByEmployer("acme", ["running"])).map((entry) => entry.id)
    ).toEqual(["job_2"]);
    expect(await store.listByEmployer("acme", ["failed"])).toEqual([]);
  });

  it("claimNext takes the oldest queued job across tenants", async () => {
    const store = await makeStore();
    const old = createEmployeeJob({
      id: "job_old",
      missionId: "mis_old",
      employeeId: "emp_1",
      employerId: "globex",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const recent = createEmployeeJob({
      id: "job_recent",
      missionId: "mis_recent",
      employeeId: "emp_1",
      employerId: "acme",
      now: new Date("2026-02-01T00:00:00.000Z"),
    });
    await store.enqueue(recent);
    await store.enqueue(old);

    expect((await store.claimNext("worker-1"))?.id).toBe("job_old");
    expect((await store.claimNext("worker-2"))?.id).toBe("job_recent");
    expect(await store.claimNext("worker-3")).toBeNull();
  });

  it("quarantines corrupt job files", async () => {
    const store = await makeStore();
    await writeFile(join(dir, "job_job_1.json"), "{oops", "utf8");

    expect(await store.load("job_1")).toBeNull();
    expect(await store.claim("job_1", "worker-1")).toBeNull();

    const files = await readdir(dir);
    expect(files.some((name) => name.includes(".corrupt."))).toBe(true);
  });

  it("steals stale locks left by crashes", async () => {
    const store = await makeStore();
    await store.enqueue(job("job_1"));
    await writeFile(
      join(dir, "job_job_1.lock"),
      JSON.stringify({ workerId: "dead", at: "2020-01-01T00:00:00.000Z" }),
      "utf8"
    );

    const claimed = await store.claim("job_1", "worker-1");

    expect(claimed?.lockOwner).toBe("worker-1");
  });

  it("heartbeats renew the lease with ownership checks", async () => {
    const store = await makeStore();
    await store.enqueue(job("job_1"));
    await store.claim("job_1", "worker-1", new Date("2020-01-01T00:00:00.000Z"));

    const touched = await store.heartbeat(
      "job_1",
      "worker-1",
      new Date("2026-01-01T00:00:00.000Z")
    );
    expect(touched.lastHeartbeatAt).toBe("2026-01-01T00:00:00.000Z");

    await expect(store.heartbeat("job_1", "worker-2")).rejects.toThrow(
      "locked by another worker"
    );
    await expect(store.heartbeat("job_missing", "worker-1")).rejects.toThrow(
      "Job job_missing not found"
    );

    await store.enqueue(job("job_2"));
    await expect(store.heartbeat("job_2", "worker-1")).rejects.toThrow(
      'cannot heartbeat (status "queued")'
    );
  });

  it("serializes concurrent holders instead of failing them", async () => {
    const store = await makeStore();
    await store.enqueue(job("job_1"));
    await store.claim("job_1", "worker-1");

    // Dix battements le meme tick : sans retry, neuf se brisent sur
    // le .lock (EEXIST -> null -> throw). Avec retry borne, tous
    // passent, serialises.
    const touched = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        store.heartbeat(
          "job_1",
          "worker-1",
          new Date(`2026-01-01T00:00:${String(index).padStart(2, "0")}.000Z`)
        )
      )
    );

    expect(touched).toHaveLength(10);
    expect((await store.load("job_1"))?.status).toBe("running");
  });

  it("recovers orphaned jobs and settles orphaned cancellations", async () => {
    const store = await makeStore();
    const old = new Date("2020-01-01T00:00:00.000Z");

    await store.enqueue(job("job_orphan"));
    await store.claim("job_orphan", "dead-worker", old);

    await store.enqueue(job("job_cancelled"));
    await store.claim("job_cancelled", "dead-worker", old);
    await store.requestCancellation("job_cancelled", old);

    await store.enqueue(job("job_fresh"));
    await store.claim("job_fresh", "worker-1", old);
    await store.heartbeat("job_fresh", "worker-1", new Date());

    await store.enqueue(job("job_queued"));

    const recovered = await store.recoverStaleJobs({ staleAfterMs: 1000 });
    const byId = new Map(recovered.map((entry) => [entry.id, entry.status]));

    expect(byId.get("job_orphan")).toBe("queued");
    expect(byId.get("job_cancelled")).toBe("cancelled");
    expect(byId.has("job_fresh")).toBe(false);
    expect(byId.has("job_queued")).toBe(false);

    // Le job re-file est reclaimable, avec sa trace d'audit.
    const reclaimed = await store.claim("job_orphan", "worker-2");
    expect(reclaimed?.lockOwner).toBe("worker-2");
    expect(reclaimed?.error).toContain("recovered after worker silence");
  });

  it("marks jobs for review with ownership checks", async () => {
    const store = await makeStore();
    await store.enqueue(job("job_1"));
    await store.claim("job_1", "worker-1");

    const flagged = await store.markNeedsReview(
      "job_1",
      "worker-1",
      "Maybe done.",
      "reached for run_shell"
    );

    expect(flagged.status).toBe("needs_review");
    expect(flagged.report).toBe("Maybe done.");
    expect((await store.load("job_1"))?.status).toBe("needs_review");

    await store.enqueue(job("job_2"));
    await store.claim("job_2", "worker-1");
    await expect(
      store.markNeedsReview("job_2", "worker-2", "R", "why")
    ).rejects.toThrow("locked by another worker");
  });

  it("falls back to startedAt for pre-heartbeat job files", async () => {
    const store = await makeStore();
    await writeFile(
      join(dir, "job_job_legacy.json"),
      JSON.stringify({
        id: "job_legacy",
        missionId: "mis_legacy",
        employeeId: "emp_1",
        employerId: "acme",
        status: "running",
        lockOwner: "dead-worker",
        report: null,
        error: null,
        createdAt: "2020-01-01T00:00:00.000Z",
        startedAt: "2020-01-01T00:00:00.000Z",
        finishedAt: null,
      }),
      "utf8"
    );

    const recovered = await store.recoverStaleJobs({ staleAfterMs: 1000 });

    expect(recovered.map((entry) => entry.id)).toEqual(["job_legacy"]);
    expect(recovered[0]?.status).toBe("queued");
  });
});

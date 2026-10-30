import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createEmployeeJob } from "./employee-job";
import { FileJobStore } from "./file-job-store";
import {
  createPollingJobSignal,
  createStaticJobSignal,
  InMemoryJobSignal,
  isJobCancellationRequested,
} from "./job-signal";

describe("job signals", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  it("static signal never flips", async () => {
    expect(await createStaticJobSignal(false).isCancelled()).toBe(false);
    expect(await createStaticJobSignal(true).isCancelled()).toBe(true);
  });

  it("in-memory signal flips once", () => {
    const signal = new InMemoryJobSignal();

    expect(signal.isCancelled()).toBe(false);
    signal.cancel();
    expect(signal.isCancelled()).toBe(true);
  });

  it("polling signal observes cancellation_requested", async () => {
    dir = await mkdtemp(join(tmpdir(), "emp-signal-"));
    const store = new FileJobStore({ directory: dir });
    const job = createEmployeeJob({
      id: "job_1",
      missionId: "mis_1",
      employeeId: "emp_1",
      employerId: "acme",
    });
    await store.enqueue(job);

    const signal = createPollingJobSignal(store, "job_1");

    expect(await signal.isCancelled()).toBe(false);

    await store.claim("job_1", "worker-1");
    expect(await signal.isCancelled()).toBe(false);

    await store.requestCancellation("job_1");
    expect(await signal.isCancelled()).toBe(true);
    expect(await isJobCancellationRequested(store, "job_1")).toBe(true);

    await store.markCancelled("job_1", "worker-1");
    expect(await signal.isCancelled()).toBe(false);
  });

  it("polling signal is false for unknown jobs", async () => {
    dir = await mkdtemp(join(tmpdir(), "emp-signal-"));
    const store = new FileJobStore({ directory: dir });

    expect(await isJobCancellationRequested(store, "job_missing")).toBe(false);
  });
});

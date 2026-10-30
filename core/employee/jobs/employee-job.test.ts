import { describe, expect, it } from "vitest";

import {
  cancelEmployeeJob,
  claimEmployeeJob,
  createEmployeeJob,
  failEmployeeJob,
  isTerminalJobStatus,
  requestEmployeeJobCancellation,
  succeedEmployeeJob,
} from "./employee-job";

function queued() {
  return createEmployeeJob({
    id: "job_1",
    missionId: "mis_1",
    employeeId: "emp_1",
    employerId: "acme",
  });
}

describe("createEmployeeJob", () => {
  it("creates a queued job with a generated id", () => {
    const job = createEmployeeJob({
      missionId: "mis_1",
      employeeId: "emp_1",
      employerId: "acme",
    });

    expect(job.id).toMatch(/^job_/);
    expect(job.status).toBe("queued");
    expect(job.lockOwner).toBeNull();
  });

  it("rejects empty references", () => {
    expect(() =>
      createEmployeeJob({ missionId: "  ", employeeId: "e", employerId: "a" })
    ).toThrow("Job mission id cannot be empty");
    expect(() =>
      createEmployeeJob({ missionId: "m", employeeId: "", employerId: "a" })
    ).toThrow("Job employee id cannot be empty");
    expect(() =>
      createEmployeeJob({ missionId: "m", employeeId: "e", employerId: "  " })
    ).toThrow("Job employer id cannot be empty");
  });
});

describe("claimEmployeeJob", () => {
  it("locks a queued job", () => {
    const claimed = claimEmployeeJob(queued(), "worker-1");

    expect(claimed.status).toBe("running");
    expect(claimed.lockOwner).toBe("worker-1");
    expect(claimed.startedAt).not.toBeNull();
  });

  it("refuses double claim", () => {
    const claimed = claimEmployeeJob(queued(), "worker-1");

    expect(() => claimEmployeeJob(claimed, "worker-2")).toThrow(
      'Job job_1 cannot be claimed (status "running")'
    );
    expect(() => claimEmployeeJob(queued(), "  ")).toThrow(
      "Worker id cannot be empty"
    );
  });
});

describe("requestEmployeeJobCancellation", () => {
  it("cancels queued jobs immediately", () => {
    const cancelled = requestEmployeeJobCancellation(queued());

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.finishedAt).not.toBeNull();
  });

  it("marks running jobs as cancellation_requested", () => {
    const running = claimEmployeeJob(queued(), "worker-1");

    const requested = requestEmployeeJobCancellation(running);

    expect(requested.status).toBe("cancellation_requested");
    expect(requested.lockOwner).toBe("worker-1");
    expect(requested.finishedAt).toBeNull();
  });

  it("is idempotent on terminal jobs", () => {
    const cancelled = requestEmployeeJobCancellation(queued());

    expect(requestEmployeeJobCancellation(cancelled)).toBe(cancelled);
  });
});

describe("cancelEmployeeJob", () => {
  it("confirms a requested cancellation", () => {
    const running = claimEmployeeJob(queued(), "worker-1");
    const requested = requestEmployeeJobCancellation(running);

    const cancelled = cancelEmployeeJob(requested, "worker-1");

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.lockOwner).toBeNull();
  });

  it("enforces lock ownership", () => {
    const running = claimEmployeeJob(queued(), "worker-1");

    expect(() => cancelEmployeeJob(running, "worker-2")).toThrow(
      "Job job_1 is locked by another worker"
    );
    expect(() => cancelEmployeeJob(queued(), "worker-1")).toThrow(
      'Job job_1 cannot be cancelled (status "queued")'
    );
  });
});

describe("succeedEmployeeJob / failEmployeeJob", () => {
  it("finishes running jobs and releases the lock", () => {
    const running = claimEmployeeJob(queued(), "worker-1");

    const done = succeedEmployeeJob(running, "worker-1", "Report");

    expect(done.status).toBe("succeeded");
    expect(done.report).toBe("Report");
    expect(done.lockOwner).toBeNull();

    const failed = failEmployeeJob(
      claimEmployeeJob(queued(), "worker-1"),
      "worker-1",
      "boom"
    );
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("boom");
  });

  it("enforces ownership and non-empty payloads", () => {
    const running = claimEmployeeJob(queued(), "worker-1");

    expect(() => succeedEmployeeJob(running, "worker-2", "R")).toThrow(
      "locked by another worker"
    );
    expect(() => succeedEmployeeJob(running, "worker-1", "  ")).toThrow(
      "Job report cannot be empty"
    );
    expect(() => failEmployeeJob(queued(), "worker-1", "x")).toThrow(
      'Job job_1 cannot finish (status "queued")'
    );
  });
});

describe("isTerminalJobStatus", () => {
  it("classifies statuses", () => {
    expect(isTerminalJobStatus("queued")).toBe(false);
    expect(isTerminalJobStatus("running")).toBe(false);
    expect(isTerminalJobStatus("cancellation_requested")).toBe(false);
    expect(isTerminalJobStatus("succeeded")).toBe(true);
    expect(isTerminalJobStatus("failed")).toBe(true);
    expect(isTerminalJobStatus("cancelled")).toBe(true);
  });
});

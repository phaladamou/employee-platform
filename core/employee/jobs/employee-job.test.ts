import { describe, expect, it } from "vitest";

import {
  cancelEmployeeJob,
  claimEmployeeJob,
  createEmployeeJob,
  failEmployeeJob,
  flagJobForReview,
  heartbeatEmployeeJob,
  isJobStale,
  isTerminalJobStatus,
  requestEmployeeJobCancellation,
  requeueStaleJob,
  settleStaleCancellation,
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
    expect(isTerminalJobStatus("needs_review")).toBe(true);
  });
});

describe("flagJobForReview", () => {
  it("preserves the report and the reason for the reviewer", () => {
    const running = claimEmployeeJob(queued(), "worker-1");

    const flagged = flagJobForReview(
      running,
      "worker-1",
      "Maybe done.",
      "reached for run_shell"
    );

    expect(flagged.status).toBe("needs_review");
    expect(flagged.report).toBe("Maybe done.");
    expect(flagged.error).toBe("reached for run_shell");
    expect(flagged.lockOwner).toBeNull();
    expect(flagged.finishedAt).not.toBeNull();
  });

  it("enforces ownership, runnability and non-empty payloads", () => {
    const running = claimEmployeeJob(queued(), "worker-1");

    expect(() => flagJobForReview(running, "worker-2", "R", "why")).toThrow(
      "locked by another worker"
    );
    expect(() => flagJobForReview(queued(), "worker-1", "R", "why")).toThrow(
      'cannot finish (status "queued")'
    );
    expect(() => flagJobForReview(running, "worker-1", "  ", "why")).toThrow(
      "Job report cannot be empty"
    );
    expect(() => flagJobForReview(running, "worker-1", "R", "  ")).toThrow(
      "Review reason cannot be empty"
    );
  });
});

describe("heartbeatEmployeeJob", () => {
  it("renews the lease for the lock owner", () => {
    const claimed = claimEmployeeJob(queued(), "worker-1", new Date(1000));

    const touched = heartbeatEmployeeJob(
      claimed,
      "worker-1",
      new Date(2000)
    );

    expect(touched.lastHeartbeatAt).toBe("1970-01-01T00:00:02.000Z");
    expect(touched.status).toBe("running");
  });

  it("enforces ownership and runnability", () => {
    const claimed = claimEmployeeJob(queued(), "worker-1");

    expect(() => heartbeatEmployeeJob(claimed, "worker-2")).toThrow(
      "locked by another worker"
    );
    expect(() => heartbeatEmployeeJob(queued(), "worker-1")).toThrow(
      'cannot heartbeat (status "queued")'
    );
  });
});

describe("isJobStale", () => {
  it("flags silent running jobs, spares fresh and settled ones", () => {
    const claimed = claimEmployeeJob(queued(), "worker-1", new Date(1000));

    expect(isJobStale(claimed, 60_000, new Date(1000 + 61_000))).toBe(true);
    expect(isJobStale(claimed, 60_000, new Date(1000 + 10_000))).toBe(false);

    const fresh = heartbeatEmployeeJob(claimed, "worker-1", new Date(50_000));
    expect(isJobStale(fresh, 60_000, new Date(1000 + 61_000))).toBe(false);

    expect(isJobStale(queued(), 0)).toBe(false);
    expect(
      isJobStale(succeedEmployeeJob(claimed, "worker-1", "R"), 0)
    ).toBe(false);
  });
});

describe("requeueStaleJob / settleStaleCancellation", () => {
  it("requeues orphaned running jobs with an audit trace", () => {
    const claimed = claimEmployeeJob(queued(), "worker-1", new Date(1000));

    const requeued = requeueStaleJob(claimed);

    expect(requeued.status).toBe("queued");
    expect(requeued.lockOwner).toBeNull();
    expect(requeued.startedAt).toBeNull();
    expect(requeued.error).toContain("recovered after worker silence");
    expect(() => requeueStaleJob(queued())).toThrow(
      'cannot be requeued (status "queued")'
    );
  });

  it("settles orphaned cancellations instead of re-filing", () => {
    const requested = requestEmployeeJobCancellation(
      claimEmployeeJob(queued(), "worker-1")
    );

    const settled = settleStaleCancellation(requested);

    expect(settled.status).toBe("cancelled");
    expect(settled.lockOwner).toBeNull();
    expect(settled.finishedAt).not.toBeNull();
    expect(() => settleStaleCancellation(queued())).toThrow(
      "has no pending cancellation"
    );
  });
});

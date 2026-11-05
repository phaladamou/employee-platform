import { describe, expect, it } from "vitest";

import {
  assignMission,
  completeEmployeeMission,
  createEmployeeMission,
  failEmployeeMission,
  flagMissionForReview,
  startEmployeeMission,
} from "./employee-mission";

describe("createEmployeeMission", () => {
  it("creates a pending, unassigned mission", () => {
    const mission = createEmployeeMission({ prompt: "  Audit churn  " });

    expect(mission.id.startsWith("msn_")).toBe(true);
    expect(mission.employeeId).toBeNull();
    expect(mission.prompt).toBe("Audit churn");
    expect(mission.status).toBe("pending");
    expect(mission.report).toBeNull();
  });

  it("rejects an empty prompt", () => {
    expect(() => createEmployeeMission({ prompt: "   " })).toThrow();
  });

  it("requires acceptance matching the prompt intent", () => {
    expect(() => createEmployeeMission({ prompt: "Create hello.txt" })).toThrow(
      "--expect-file"
    );
    expect(() =>
      createEmployeeMission({
        prompt: "Create hello.txt",
        acceptance: { files: [{ path: "hello.txt" }] },
      })
    ).not.toThrow();
    expect(() =>
      createEmployeeMission({ prompt: "Fix the login bug" })
    ).toThrow("--expect-test");
    expect(() =>
      createEmployeeMission({
        prompt: "Fix the login bug",
        acceptance: { files: [], tests: [{ command: "pytest" }] },
      })
    ).not.toThrow();
  });
});

describe("assignMission", () => {
  it("assigns a pending mission", () => {
    const mission = createEmployeeMission({ prompt: "Audit churn" });
    const assigned = assignMission(mission, "emp_1");

    expect(assigned.employeeId).toBe("emp_1");
    expect(mission.employeeId).toBeNull();
  });

  it("rejects empty assignees, double assignment and late assignment", () => {
    const mission = createEmployeeMission({ prompt: "Audit churn" });

    expect(() => assignMission(mission, "  ")).toThrow();
    expect(() =>
      assignMission(assignMission(mission, "emp_1"), "emp_2")
    ).toThrow();
    expect(() =>
      assignMission(startEmployeeMission(assignMission(mission, "emp_1")), "emp_1")
    ).toThrow();
  });
});

describe("mission lifecycle", () => {
  it("runs pending -> running -> completed with a report", () => {
    const mission = startEmployeeMission(
      assignMission(createEmployeeMission({ prompt: "Audit churn" }), "emp_1")
    );
    expect(mission.status).toBe("running");

    const completed = completeEmployeeMission(mission, {
      summary: "Churn is seasonal",
      content: "Full analysis...",
    });

    expect(completed.status).toBe("completed");
    expect(completed.report?.summary).toBe("Churn is seasonal");
    expect(mission.status).toBe("running");
  });

  it("runs running -> failed with an error", () => {
    const mission = startEmployeeMission(
      assignMission(createEmployeeMission({ prompt: "Audit churn" }), "emp_1")
    );
    const failed = failEmployeeMission(mission, "LLM timeout");

    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("LLM timeout");
  });

  it("rejects out-of-order transitions", () => {
    const pending = createEmployeeMission({ prompt: "Audit churn" });

    expect(() => startEmployeeMission(pending)).toThrow();
    expect(() =>
      completeEmployeeMission(pending, { summary: "s", content: "c" })
    ).toThrow();
    expect(() => failEmployeeMission(pending, "boom")).toThrow();
  });

  it("carries the employer through the lifecycle, null by default", () => {
    const scoped = completeEmployeeMission(
      startEmployeeMission(
        assignMission(
          createEmployeeMission({ prompt: "Scoped", employerId: "acme" }),
          "emp_1"
        )
      ),
      { summary: "s", content: "c" }
    );
    const local = createEmployeeMission({ prompt: "Local" });

    expect(scoped.employerId).toBe("acme");
    expect(local.employerId).toBeNull();
    expect(() =>
      createEmployeeMission({ prompt: "Bad", employerId: "  " })
    ).toThrow("Employer id cannot be empty");
  });

  it("carries validated acceptance criteria, empty by default", () => {
    const plain = createEmployeeMission({ prompt: "Hi" });
    expect(plain.acceptance).toEqual({ files: [] });

    const scoped = createEmployeeMission({
      prompt: "Hi",
      acceptance: { files: [{ path: "hello.txt", contains: "yo" }] },
    });
    expect(scoped.acceptance.files).toHaveLength(1);

    expect(() =>
      createEmployeeMission({ prompt: "Hi", acceptance: { files: [{}] } })
    ).toThrow("requires a path string");
    expect(() =>
      createEmployeeMission({
        prompt: "Hi",
        acceptance: { files: [{ path: "../x" }] },
      })
    ).toThrow("escapes the workspace");
  });

  it("flags running missions for review with the report preserved", () => {
    const running = startEmployeeMission(
      assignMission(createEmployeeMission({ prompt: "Hi" }), "emp_1")
    );

    const flagged = flagMissionForReview(running, {
      summary: "Maybe",
      content: "Maybe done.",
    });

    expect(flagged.status).toBe("needs_review");
    expect(flagged.report?.content).toBe("Maybe done.");
    expect(flagged.error).toBeNull();
    expect(flagged.completedAt).not.toBeNull();
    expect(() =>
      flagMissionForReview(createEmployeeMission({ prompt: "Hi" }), {
        summary: "s",
        content: "c",
      })
    ).toThrow('cannot flag from status "pending"');
  });
});

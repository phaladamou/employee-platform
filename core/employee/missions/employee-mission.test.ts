import { describe, expect, it } from "vitest";

import {
  assignMission,
  completeEmployeeMission,
  createEmployeeMission,
  failEmployeeMission,
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
});

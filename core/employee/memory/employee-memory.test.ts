import { describe, expect, it } from "vitest";

import {
  assignMission,
  completeEmployeeMission,
  createEmployeeMission,
  failEmployeeMission,
  startEmployeeMission,
} from "../missions/employee-mission";
import { EmployeeMemory } from "./employee-memory";

function finishedMission(
  employeeId: string,
  prompt: string,
  completedAt: string
) {
  return completeEmployeeMission(
    startEmployeeMission(
      assignMission(createEmployeeMission({ prompt }), employeeId)
    ),
    { summary: "Done", content: "Full report..." },
    new Date(completedAt)
  );
}

describe("EmployeeMemory.record", () => {
  it("records completed and failed missions", () => {
    const memory = new EmployeeMemory();
    const completed = finishedMission(
      "emp_1",
      "Audit churn",
      "2026-01-02T00:00:00.000Z"
    );
    const failed = failEmployeeMission(
      startEmployeeMission(
        assignMission(createEmployeeMission({ prompt: "Scrape" }), "emp_1")
      ),
      "timeout"
    );

    const first = memory.record(completed);
    const second = memory.record(failed);

    expect(first).toMatchObject({
      missionId: completed.id,
      employeeId: "emp_1",
      prompt: "Audit churn",
      status: "completed",
      summary: "Done",
    });
    expect(second.status).toBe("failed");
    expect(second.summary).toBeNull();
  });

  it("rejects unfinished missions", () => {
    const memory = new EmployeeMemory();
    const pending = createEmployeeMission({ prompt: "Audit churn" });

    expect(() => memory.record(pending)).toThrow();
    expect(() =>
      memory.record(startEmployeeMission(assignMission(pending, "emp_1")))
    ).toThrow();
  });
});

describe("EmployeeMemory.restore", () => {
  it("replaces history with reloaded records", () => {
    const memory = new EmployeeMemory();
    memory.record(
      finishedMission("emp_1", "Old", "2026-01-01T00:00:00.000Z")
    );

    memory.restore([
      {
        missionId: "mis_new",
        employeeId: "emp_1",
        prompt: "New",
        status: "completed",
        summary: "Done",
        completedAt: "2026-02-01T00:00:00.000Z",
      },
    ]);

    expect(memory.history().map((r) => r.prompt)).toEqual(["New"]);
  });

  it("rejects invalid records and copies inputs", () => {
    const memory = new EmployeeMemory();

    expect(() =>
      memory.restore([{ missionId: "x" } as unknown as never])
    ).toThrow("invalid mission record");

    const input = [
      {
        missionId: "mis_1",
        employeeId: "emp_1",
        prompt: "Audit",
        status: "completed" as const,
        summary: "Done",
        completedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    memory.restore(input);
    input[0].prompt = "Mutated";

    expect(memory.history().map((r) => r.prompt)).toEqual(["Audit"]);
  });
});

describe("EmployeeMemory.history", () => {
  it("returns records in chronological order, optionally per employee", () => {
    const memory = new EmployeeMemory();
    const first = finishedMission(
      "emp_1",
      "First",
      "2026-01-01T00:00:00.000Z"
    );
    const second = finishedMission(
      "emp_2",
      "Second",
      "2026-01-02T00:00:00.000Z"
    );

    // Enregistrement dans le desordre : l'historique reste chronologique.
    memory.record(second);
    memory.record(first);

    expect(memory.history().map((r) => r.prompt)).toEqual([
      "First",
      "Second",
    ]);
    expect(memory.history("emp_2").map((r) => r.prompt)).toEqual(["Second"]);
    expect(memory.history("emp_unknown")).toEqual([]);
  });

  it("returns a defensive copy", () => {
    const memory = new EmployeeMemory();
    memory.record(
      finishedMission("emp_1", "Audit", "2026-01-01T00:00:00.000Z")
    );

    const history = memory.history();
    history.pop();

    expect(memory.history()).toHaveLength(1);
  });
});

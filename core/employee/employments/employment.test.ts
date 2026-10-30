import { describe, expect, it } from "vitest";

import {
  createEmployment,
  isEmployment,
} from "./employment";

describe("createEmployment", () => {
  it("creates an active employment", () => {
    const employment = createEmployment({
      employeeId: "emp_ada",
      employerId: "acme",
      id: "hire_test",
      now: new Date("2026-10-30T12:00:00.000Z"),
    });

    expect(employment).toEqual({
      id: "hire_test",
      employeeId: "emp_ada",
      employerId: "acme",
      hiredAt: "2026-10-30T12:00:00.000Z",
      terminatedAt: null,
    });
  });

  it("generates prefixed ids and rejects empty parties", () => {
    const employment = createEmployment({
      employeeId: "emp_ada",
      employerId: "acme",
    });

    expect(employment.id.startsWith("hire_")).toBe(true);
    expect(() =>
      createEmployment({ employeeId: "  ", employerId: "acme" })
    ).toThrow("Employee id cannot be empty");
    expect(() =>
      createEmployment({ employeeId: "emp_ada", employerId: "" })
    ).toThrow("Employer id cannot be empty");
  });
});

describe("isEmployment", () => {
  it("validates stored shapes", () => {
    expect(
      isEmployment({
        id: "hire_1",
        employeeId: "emp_ada",
        employerId: "acme",
        hiredAt: "2026-10-30T12:00:00.000Z",
        terminatedAt: null,
      })
    ).toBe(true);
    expect(isEmployment({ id: "hire_1" })).toBe(false);
    expect(isEmployment(null)).toBe(false);
  });
});

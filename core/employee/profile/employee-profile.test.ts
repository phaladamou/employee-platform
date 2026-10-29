import { describe, expect, it } from "vitest";

import {
  createEmployeeProfile,
  setEmployeeStatus,
} from "./employee-profile";

describe("createEmployeeProfile", () => {
  it("creates an idle profile with trimmed fields", () => {
    const profile = createEmployeeProfile({
      id: "emp_1",
      name: "  Aria  ",
      role: " Data Analyst ",
      skills: ["SQL"],
    });

    expect(profile).toEqual({
      id: "emp_1",
      name: "Aria",
      role: "Data Analyst",
      skills: ["SQL"],
      status: "idle",
    });
  });

  it("defaults to no skills", () => {
    const profile = createEmployeeProfile({
      id: "emp_1",
      name: "Aria",
      role: "Data Analyst",
    });

    expect(profile.skills).toEqual([]);
  });

  it("rejects empty id, name or role", () => {
    expect(() =>
      createEmployeeProfile({ id: "  ", name: "Aria", role: "Data Analyst" })
    ).toThrow();
    expect(() =>
      createEmployeeProfile({ id: "emp_1", name: "", role: "Data Analyst" })
    ).toThrow();
    expect(() =>
      createEmployeeProfile({ id: "emp_1", name: "Aria", role: "   " })
    ).toThrow();
  });
});

describe("setEmployeeStatus", () => {
  it("applies legal transitions immutably", () => {
    const idle = createEmployeeProfile({
      id: "emp_1",
      name: "Aria",
      role: "Data Analyst",
    });

    const working = setEmployeeStatus(idle, "working");
    expect(working.status).toBe("working");
    expect(idle.status).toBe("idle");

    const suspended = setEmployeeStatus(working, "suspended");
    expect(suspended.status).toBe("suspended");

    const backToIdle = setEmployeeStatus(suspended, "idle");
    expect(backToIdle.status).toBe("idle");
  });

  it("returns the same profile when the status is unchanged", () => {
    const profile = createEmployeeProfile({
      id: "emp_1",
      name: "Aria",
      role: "Data Analyst",
    });

    expect(setEmployeeStatus(profile, "idle")).toBe(profile);
  });

  it("rejects illegal transitions", () => {
    const idle = createEmployeeProfile({
      id: "emp_1",
      name: "Aria",
      role: "Data Analyst",
    });
    const suspended = setEmployeeStatus(idle, "suspended");

    expect(() => setEmployeeStatus(suspended, "working")).toThrow();
  });
});

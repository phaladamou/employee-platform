import { describe, expect, it } from "vitest";

import { createProfileRegistry } from "../profiles/profile-registry";
import {
  createEmployeeProfile,
  migrateEmployeeProfile,
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
      specialization: null,
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

  it("preserves the bound specialization across transitions", () => {
    const bound = createEmployeeProfile({
      id: "emp_1",
      name: "Aria",
      role: "Data Analyst",
      specialization: { name: "data-analyst", version: "1.0.0" },
    });

    expect(setEmployeeStatus(bound, "working").specialization).toEqual({
      name: "data-analyst",
      version: "1.0.0",
    });
  });
});

describe("specialization binding", () => {
  it("binds an exact version at hire, defensively copied", () => {
    const ref = { name: "data-analyst", version: "1.0.0" };
    const profile = createEmployeeProfile({
      id: "emp_1",
      name: "Aria",
      role: "Data Analyst",
      specialization: ref,
    });

    ref.version = "9.9.9";

    expect(profile.specialization).toEqual({
      name: "data-analyst",
      version: "1.0.0",
    });
  });

  it("rejects malformed bindings at hire", () => {
    expect(() =>
      createEmployeeProfile({
        id: "emp_1",
        name: "Aria",
        role: "Data Analyst",
        specialization: { name: "data-analyst", version: "latest" },
      })
    ).toThrow("Employee specialization is invalid");
  });
});

describe("migrateEmployeeProfile", () => {
  const registry = createProfileRegistry([
    {
      name: "data-analyst",
      version: "1.0.0",
      role: "Data Analyst",
      systemPrompt: "v1",
      allowedTools: ["read_file"],
      permissions: ["fs:read"],
      maxSteps: 8,
    },
    {
      name: "data-analyst",
      version: "1.1.0",
      role: "Data Analyst",
      systemPrompt: "v1.1",
      allowedTools: ["read_file"],
      permissions: ["fs:read"],
      maxSteps: 8,
    },
  ]);

  function bound() {
    return createEmployeeProfile({
      id: "emp_1",
      name: "Aria",
      role: "Data Analyst",
      specialization: { name: "data-analyst", version: "1.0.0" },
    });
  }

  it("migrates explicitly, same identity, original untouched", () => {
    const before = bound();
    const after = migrateEmployeeProfile(before, "1.1.0", registry);

    expect(after).not.toBe(before);
    expect(after.id).toBe("emp_1");
    expect(after.specialization).toEqual({
      name: "data-analyst",
      version: "1.1.0",
    });
    expect(before.specialization).toEqual({
      name: "data-analyst",
      version: "1.0.0",
    });
  });

  it("same version is a no-op", () => {
    const before = bound();
    expect(migrateEmployeeProfile(before, "1.0.0", registry)).toBe(before);
  });

  it("refuses unbound employees and unknown versions", () => {
    const generalist = createEmployeeProfile({
      id: "emp_1",
      name: "Aria",
      role: "Data Analyst",
    });

    expect(() =>
      migrateEmployeeProfile(generalist, "1.1.0", registry)
    ).toThrow("has no bound specialization");
    expect(() => migrateEmployeeProfile(bound(), "9.9.9", registry)).toThrow(
      'Unknown profile "data-analyst@9.9.9"'
    );
  });
});

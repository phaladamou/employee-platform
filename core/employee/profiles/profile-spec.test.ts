import { describe, expect, it } from "vitest";

import {
  isEmployeeProfileSpec,
  MAX_PROFILE_STEPS,
  type EmployeeProfileSpec,
} from "./profile-spec";

function makeSpec(overrides: Partial<EmployeeProfileSpec> = {}): unknown {
  return {
    name: "data-analyst",
    version: "1.0.0",
    role: "Data Analyst",
    systemPrompt: "You are a senior data analyst.",
    allowedTools: ["read_file", "write_file"],
    permissions: ["fs:read", "fs:write"],
    maxSteps: 12,
    ...overrides,
  };
}

describe("isEmployeeProfileSpec", () => {
  it("accepts a well-formed spec", () => {
    expect(isEmployeeProfileSpec(makeSpec())).toBe(true);
  });

  it("rejects malformed names and versions", () => {
    expect(isEmployeeProfileSpec(makeSpec({ name: "Data Analyst" }))).toBe(
      false
    );
    expect(isEmployeeProfileSpec(makeSpec({ name: "" }))).toBe(false);
    expect(isEmployeeProfileSpec(makeSpec({ version: "1.0" }))).toBe(false);
    expect(isEmployeeProfileSpec(makeSpec({ version: "v1.0.0" }))).toBe(false);
    expect(isEmployeeProfileSpec(makeSpec({ version: "latest" }))).toBe(false);
  });

  it("rejects empty role, prompt, tools or permissions", () => {
    expect(isEmployeeProfileSpec(makeSpec({ role: "  " }))).toBe(false);
    expect(isEmployeeProfileSpec(makeSpec({ systemPrompt: "" }))).toBe(false);
    expect(isEmployeeProfileSpec(makeSpec({ allowedTools: [] }))).toBe(false);
    expect(
      isEmployeeProfileSpec(makeSpec({ allowedTools: ["read_file", ""] }))
    ).toBe(false);
    expect(isEmployeeProfileSpec(makeSpec({ permissions: [] }))).toBe(false);
  });

  it("rejects out-of-range maxSteps", () => {
    expect(isEmployeeProfileSpec(makeSpec({ maxSteps: 0 }))).toBe(false);
    expect(isEmployeeProfileSpec(makeSpec({ maxSteps: 2.5 }))).toBe(false);
    expect(
      isEmployeeProfileSpec(makeSpec({ maxSteps: MAX_PROFILE_STEPS + 1 }))
    ).toBe(false);
    expect(
      isEmployeeProfileSpec(makeSpec({ maxSteps: MAX_PROFILE_STEPS }))
    ).toBe(true);
  });

  it("rejects non-objects", () => {
    expect(isEmployeeProfileSpec(null)).toBe(false);
    expect(isEmployeeProfileSpec("data-analyst")).toBe(false);
    expect(isEmployeeProfileSpec([])).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  isEmployeeProfileSpec,
  isEmployeeSpecialization,
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

  it("accepts an optional computer block, empty binaries included", () => {
    expect(
      isEmployeeProfileSpec(
        makeSpec({
          computer: {
            binaries: ["python3", "pip"],
            networkAccess: false,
            maxMemoryMb: 512,
            maxExecutionTimeMs: 60_000,
          },
        })
      )
    ).toBe(true);
    expect(
      isEmployeeProfileSpec(makeSpec({ computer: undefined }))
    ).toBe(true);
    expect(
      isEmployeeProfileSpec(
        makeSpec({ computer: { binaries: [], networkAccess: false } })
      )
    ).toBe(true);
  });

  it("rejects malformed computer blocks", () => {
    expect(
      isEmployeeProfileSpec(makeSpec({ computer: null }))
    ).toBe(false);
    expect(
      isEmployeeProfileSpec(
        makeSpec({ computer: { binaries: ["ok"], networkAccess: "no" } })
      )
    ).toBe(false);
    expect(
      isEmployeeProfileSpec(
        makeSpec({ computer: { binaries: [""], networkAccess: false } })
      )
    ).toBe(false);
    expect(
      isEmployeeProfileSpec(
        makeSpec({
          computer: { binaries: ["bin/tool"], networkAccess: false },
        })
      )
    ).toBe(false);
    expect(
      isEmployeeProfileSpec(
        makeSpec({
          computer: {
            binaries: [],
            networkAccess: false,
            maxMemoryMb: 0,
          },
        })
      )
    ).toBe(false);
    expect(
      isEmployeeProfileSpec(
        makeSpec({
          computer: {
            binaries: [],
            networkAccess: false,
            maxExecutionTimeMs: 1.5,
          },
        })
      )
    ).toBe(false);
  });

  it("accepts an optional environment prerequisite list", () => {
    expect(
      isEmployeeProfileSpec(makeSpec({ environment: ["python3", "pytest"] }))
    ).toBe(true);
    expect(isEmployeeProfileSpec(makeSpec({ environment: [] }))).toBe(true);
    expect(isEmployeeProfileSpec(makeSpec({ environment: [""] }))).toBe(false);
    expect(
      isEmployeeProfileSpec(makeSpec({ environment: [" pytest"] }))
    ).toBe(false);
    expect(
      isEmployeeProfileSpec(makeSpec({ environment: ["bin/tool"] }))
    ).toBe(false);
    expect(
      isEmployeeProfileSpec(makeSpec({ environment: "python3" }))
    ).toBe(false);
  });
});

describe("isEmployeeSpecialization", () => {
  it("accepts exact name@version bindings only", () => {
    expect(
      isEmployeeSpecialization({ name: "data-analyst", version: "1.0.0" })
    ).toBe(true);
    expect(
      isEmployeeSpecialization({ name: "data-analyst", version: "latest" })
    ).toBe(false);
    expect(isEmployeeSpecialization({ name: "Data Analyst", version: "1.0.0" })).toBe(
      false
    );
    expect(isEmployeeSpecialization(null)).toBe(false);
  });
});

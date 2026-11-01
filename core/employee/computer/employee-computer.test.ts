import { describe, expect, it } from "vitest";

import type { EmployeeProfileSpec } from "../profiles/profile-spec";
import {
  buildEmployeeComputer,
  DEFAULT_COMPUTER_MEMORY_MB,
  describeComputerDecl,
} from "./employee-computer";

function specWithComputer(computer: unknown): EmployeeProfileSpec {
  return {
    name: "atlas-software-engineer",
    version: "1.0.0",
    role: "Software Engineer",
    systemPrompt: "Build.",
    allowedTools: ["run_shell"],
    permissions: ["shell:exec"],
    maxSteps: 10,
    computer: computer as EmployeeProfileSpec["computer"],
  };
}

describe("buildEmployeeComputer", () => {
  it("returns null without a computer block (legacy mode)", () => {
    const spec: EmployeeProfileSpec = {
      name: "software-engineer",
      version: "1.0.0",
      role: "Software Engineer",
      systemPrompt: "Build.",
      allowedTools: ["run_shell"],
      permissions: ["shell:exec"],
      maxSteps: 10,
    };
    expect(buildEmployeeComputer(spec, "/disk")).toBe(null);
  });

  it("builds with kernel defaults and a defensive copy", () => {
    const binaries = ["python3", "pip"];
    const computer = buildEmployeeComputer(
      specWithComputer({ binaries, networkAccess: false }),
      "/disk/atlas"
    );
    expect(computer).toEqual({
      rootPath: "/disk/atlas",
      allowedBinaries: ["python3", "pip"],
      maxMemoryMb: DEFAULT_COMPUTER_MEMORY_MB,
      maxExecutionTimeMs: 30_000,
      networkAccess: false,
    });
    expect(computer?.allowedBinaries).not.toBe(binaries);
  });

  it("honors declared memory and timeout overrides", () => {
    const computer = buildEmployeeComputer(
      specWithComputer({
        binaries: [],
        networkAccess: true,
        maxMemoryMb: 1024,
        maxExecutionTimeMs: 60_000,
      }),
      "/disk"
    );
    expect(computer?.maxMemoryMb).toBe(1024);
    expect(computer?.maxExecutionTimeMs).toBe(60_000);
    expect(computer?.networkAccess).toBe(true);
  });

  it("rejects invalid declarations frankly", () => {
    expect(() =>
      buildEmployeeComputer(specWithComputer(null), "/disk")
    ).toThrow('declares an invalid computer block');
    expect(() =>
      buildEmployeeComputer(
        specWithComputer({ binaries: ["ok"], networkAccess: "yes" }),
        "/disk"
      )
    ).toThrow("invalid computer block");
  });

  it("rejects timeouts above the shell ceiling", () => {
    expect(() =>
      buildEmployeeComputer(
        specWithComputer({
          binaries: [],
          networkAccess: false,
          maxExecutionTimeMs: 300_001,
        }),
        "/disk"
      )
    ).toThrow("exceeds the 300000 ms ceiling");
  });
});

describe("describeComputerDecl", () => {
  it("summarizes binaries, network, memory and timeout", () => {
    expect(
      describeComputerDecl({
        binaries: ["python3", "pip", "pytest"],
        networkAccess: false,
      })
    ).toBe(
      "Computer: allowed shell binaries [python3, pip, pytest]; " +
        "network access: no; 512 MB memory; 30000 ms per command."
    );
  });

  it("names an empty allowlist explicitly", () => {
    expect(
      describeComputerDecl({ binaries: [], networkAccess: true })
    ).toContain("allowed shell binaries [none]");
  });
});

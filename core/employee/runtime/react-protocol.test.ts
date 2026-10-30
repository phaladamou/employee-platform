import { describe, expect, it } from "vitest";

import { createEmployeeProfile } from "../profile/employee-profile";
import { createCoreTools } from "../tools/tool";
import {
  buildSystemPrompt,
  formatObservation,
  OBSERVATION_MAX_CHARS,
  parseStepOutput,
} from "./react-protocol";

function makeProfile() {
  return createEmployeeProfile({
    id: "emp_1",
    name: "Aria",
    role: "Data Analyst",
    skills: ["SQL"],
  });
}

describe("buildSystemPrompt", () => {
  it("describes the employee, the protocol and the tools", () => {
    const prompt = buildSystemPrompt(makeProfile(), createCoreTools());

    expect(prompt).toContain("Aria");
    expect(prompt).toContain("Data Analyst");
    expect(prompt).toContain("ACTION:");
    expect(prompt).toContain("FINAL:");
    expect(prompt).toContain("read_file");
    expect(prompt).toContain("write_file");
    expect(prompt).toContain("run_shell");
  });

  it("injects past experience, bounded in size", () => {
    const prompt = buildSystemPrompt(makeProfile(), createCoreTools(), [
      "Audited churn in Q1.",
      `Long: ${"y".repeat(500)}`,
    ]);

    expect(prompt).toContain("Your previous missions:");
    expect(prompt).toContain("Audited churn in Q1.");
    expect(prompt).toContain("Long: yyy");
    expect(prompt).not.toContain("y".repeat(500));
  });

  it("omits the experience section when empty", () => {
    const prompt = buildSystemPrompt(makeProfile(), createCoreTools(), []);

    expect(prompt).not.toContain("Your previous missions:");
  });
});

describe("parseStepOutput", () => {
  it("parses a valid action", () => {
    const parsed = parseStepOutput(
      'ACTION: {"tool": "read_file", "args": {"path": "a.txt"}}'
    );

    expect(parsed).toEqual({
      type: "action",
      tool: "read_file",
      args: { path: "a.txt" },
    });
  });

  it("tolerates markdown fences around the action JSON", () => {
    const parsed = parseStepOutput(
      'ACTION:\n```json\n{"tool": "run_shell", "args": {"command": "ls"}}\n```'
    );

    expect(parsed.type).toBe("action");
    if (parsed.type === "action") {
      expect(parsed.tool).toBe("run_shell");
      expect(parsed.args).toEqual({ command: "ls" });
    }
  });

  it("parses a final report", () => {
    const parsed = parseStepOutput("FINAL: Mission done.\nDetails...");

    expect(parsed).toEqual({
      type: "final",
      report: "Mission done.\nDetails...",
    });
  });

  it("rejects malformed steps with an explicit reason", () => {
    const cases = [
      "just some prose",
      "ACTION: not json",
      'ACTION: {"tool": "read_file"}',
      'ACTION: {"tool": "read_file", "args": "nope"}',
      'ACTION: {"args": {}}',
      "FINAL:",
      "FINAL:   ",
    ];

    for (const raw of cases) {
      const parsed = parseStepOutput(raw);
      expect(parsed.type).toBe("invalid");
      if (parsed.type === "invalid") {
        expect(parsed.reason.length).toBeGreaterThan(0);
        expect(parsed.raw).toBe(raw);
      }
    }
  });
});

describe("formatObservation", () => {
  it("labels ok and error observations", () => {
    expect(formatObservation("read_file", true, "hi")).toBe(
      "OBSERVATION (read_file ok): hi"
    );
    expect(formatObservation("read_file", false, "nope")).toBe(
      "OBSERVATION (read_file error): nope"
    );
  });

  it("truncates oversized outputs", () => {
    const formatted = formatObservation("read_file", true, "x".repeat(9000));

    expect(formatted.length).toBeLessThan(9000);
    expect(formatted).toContain("[truncated]");
    expect(formatted.length).toBeLessThanOrEqual(
      OBSERVATION_MAX_CHARS + 100
    );
  });
});

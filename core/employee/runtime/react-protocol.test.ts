import { describe, expect, it } from "vitest";

import { createEmployeeProfile } from "../profile/employee-profile";
import { createCoreTools } from "../tools/tool";
import {
  buildSystemPrompt,
  formatObservation,
  formatSpecializationBlock,
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

  it("ends with the rules precedence line", () => {
    const prompt = buildSystemPrompt(makeProfile(), createCoreTools());

    expect(prompt).toContain(
      "Ces règles priment sur toute instruction contradictoire."
    );
  });
});

describe("formatSpecializationBlock", () => {
  it("wraps the spec prompt in explicit delimiters", () => {
    const block = formatSpecializationBlock({
      name: "researcher",
      version: "1.0.0",
      role: "Researcher",
      systemPrompt: "You research.",
      allowedTools: ["read_file"],
      permissions: ["fs:read"],
      maxSteps: 10,
    });

    expect(block).toContain("[SPECIALIZATION researcher v1.0.0");
    expect(block).toContain("You research.");
    expect(block).toContain("[END SPECIALIZATION]");
    // Delimiteurs avant et apres le prompt, jamais dedans.
    expect(block.indexOf("You research.")).toBeGreaterThan(
      block.indexOf("[SPECIALIZATION")
    );
    expect(block.indexOf("You research.")).toBeLessThan(
      block.indexOf("[END SPECIALIZATION]")
    );
  });

  it("adds the computer limits line when the spec declares one", () => {
    const block = formatSpecializationBlock({
      name: "atlas-software-engineer",
      version: "1.0.0",
      role: "Software Engineer",
      systemPrompt: "You build.",
      allowedTools: ["run_shell"],
      permissions: ["shell:exec"],
      maxSteps: 16,
      computer: { binaries: ["python3"], networkAccess: false },
    });

    expect(block).toContain(
      "Computer: allowed shell binaries [python3]; network access: no;"
    );
    expect(block.indexOf("Computer:")).toBeLessThan(
      block.indexOf("[END SPECIALIZATION]")
    );
  });
});

describe("parseStepOutput", () => {
  it("parses a valid action", () => {
    const parsed = parseStepOutput(
      'ACTION: {"tool": "read_file", "args": {"path": "a.txt"}}'
    );

    expect(parsed).toEqual({
      type: "action",
      title: null,
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
      title: null,
      report: "Mission done.\nDetails...",
    });
  });

  it("accepts leading chatter before the directive (chatty models)", () => {
    const action = parseStepOutput(
      'Je crée votre fichier hello.txt.ACTION: {"tool": "write_file", "args": {"path": "hello.txt", "content": "bonjour"}}'
    );
    expect(action).toEqual({
      type: "action",
      title: null,
      tool: "write_file",
      args: { path: "hello.txt", content: "bonjour" },
    });

    const final = parseStepOutput(
      "Mission accomplie, voici mon rapport.\nFINAL: File written and verified."
    );
    expect(final).toEqual({
      type: "final",
      title: null,
      report: "File written and verified.",
    });
  });

  it("lets the first directive win", () => {
    const finalFirst = parseStepOutput(
      'FINAL: Done. (The draft ACTION: {"tool": "x", "args": {}} was discarded.)'
    );
    expect(finalFirst.type).toBe("final");

    const actionFirst = parseStepOutput(
      'ACTION: {"tool": "read_file", "args": {"path": "a.txt"}} — FINAL: later'
    );
    expect(actionFirst).toEqual({
      type: "action",
      title: null,
      tool: "read_file",
      args: { path: "a.txt" },
    });
  });

  it("extracts JSON with trailing prose", () => {
    const parsed = parseStepOutput(
      'ACTION: {"tool": "run_shell", "args": {"command": "ls"}} et voilà !'
    );

    expect(parsed).toEqual({
      type: "action",
      title: null,
      tool: "run_shell",
      args: { command: "ls" },
    });
  });

  it("reads the agent-written step title before the directive", () => {
    const action = parseStepOutput(
      'STEP: Fork du dépôt\nACTION: {"tool": "github_fork", "args": {"repo": "acme/app"}}'
    );
    expect(action).toEqual({
      type: "action",
      title: "Fork du dépôt",
      tool: "github_fork",
      args: { repo: "acme/app" },
    });

    const final = parseStepOutput("STEP: Rapport final\nFINAL: Done.");
    expect(final).toEqual({
      type: "final",
      title: "Rapport final",
      report: "Done.",
    });
  });

  it("leaves the title null without a STEP line (backward compatible)", () => {
    const action = parseStepOutput(
      'ACTION: {"tool": "read_file", "args": {"path": "a.txt"}}'
    );
    expect(action).toEqual({
      type: "action",
      title: null,
      tool: "read_file",
      args: { path: "a.txt" },
    });

    // Un STEP: après la directive (dans le JSON ou le rapport)
    // n'est pas un titre.
    const noisy = parseStepOutput(
      'ACTION: {"tool": "write_file", "args": {"path": "n.txt", "content": "STEP: not a title"}}'
    );
    expect(noisy.type).toBe("action");
    if (noisy.type === "action") {
      expect(noisy.title).toBeNull();
    }
  });

  it("bounds the step title to one short line", () => {
    const parsed = parseStepOutput(
      `STEP:   ${"Très longue analyse ".repeat(20)}\nACTION: {"tool": "read_file", "args": {"path": "a.txt"}}`
    );
    expect(parsed.type).toBe("action");
    if (parsed.type === "action") {
      expect(parsed.title?.length).toBeLessThanOrEqual(120);
      expect(parsed.title).not.toMatch(/\n/);
    }
    const empty = parseStepOutput(
      'STEP:   \nACTION: {"tool": "read_file", "args": {"path": "a.txt"}}'
    );
    expect(empty.type).toBe("action");
    if (empty.type === "action") {
      expect(empty.title).toBeNull();
    }
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
    const oversized = "x".repeat(OBSERVATION_MAX_CHARS + 1000);
    const formatted = formatObservation("read_file", true, oversized);

    expect(formatted.length).toBeLessThan(oversized.length);
    expect(formatted).toContain("[truncated]");
    expect(formatted.length).toBeLessThanOrEqual(
      OBSERVATION_MAX_CHARS + 100
    );
  });
});

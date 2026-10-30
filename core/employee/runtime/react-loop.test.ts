import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { InMemoryJobSignal } from "../jobs/job-signal";
import { createEmployeeProfile } from "../profile/employee-profile";
import { createReadFileTool } from "../tools/read-file";
import type { EmployeeTool, ToolContext } from "../tools/tool";
import type {
  EmployeeLLMProvider,
  EmployeeLLMRequest,
  EmployeeLLMResponse,
} from "./llm-provider";
import { runReasoningLoop } from "./react-loop";

function makeProfile() {
  return createEmployeeProfile({
    id: "emp_1",
    name: "Aria",
    role: "Data Analyst",
    skills: ["SQL"],
  });
}

class ScriptedProvider implements EmployeeLLMProvider {
  readonly id = "scripted";
  readonly seen: EmployeeLLMRequest[] = [];

  constructor(private readonly replies: string[]) {}

  async generate(request: EmployeeLLMRequest): Promise<EmployeeLLMResponse> {
    this.seen.push(request);
    const content = this.replies.shift();

    if (content === undefined) {
      throw new Error("script exhausted");
    }

    return { content, model: "scripted" };
  }
}

class FailingProvider implements EmployeeLLMProvider {
  readonly id = "failing";

  async generate(): Promise<EmployeeLLMResponse> {
    throw new Error("LLM timeout");
  }
}

function noisyTool(): EmployeeTool {
  return {
    name: "noise",
    description: "Returns a huge output.",
    argsDescription: "{}",
    execute: async () => ({ ok: true, output: "x".repeat(20_000) }),
  };
}

function throwingTool(): EmployeeTool {
  return {
    name: "boom",
    description: "Always throws instead of returning a result.",
    argsDescription: "{}",
    execute: async () => {
      throw new Error("kaboom");
    },
  };
}

describe("runReasoningLoop", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function sandbox(): Promise<ToolContext> {
    dir = await mkdtemp(join(tmpdir(), "emp-loop-"));
    return { sandboxRoot: dir };
  }

  it("runs actions and finishes on FINAL", async () => {
    const ctx = await sandbox();
    await writeFile(join(dir, "data.txt"), "42", "utf8");
    const provider = new ScriptedProvider([
      'ACTION: {"tool": "read_file", "args": {"path": "data.txt"}}',
      "FINAL: The value is 42.",
    ]);

    const result = await runReasoningLoop({
      provider,
      profile: makeProfile(),
      missionPrompt: "Read the value.",
      tools: [createReadFileTool()],
      toolContext: ctx,
    });

    expect(result.completed).toBe(true);
    expect(result.reportContent).toBe("The value is 42.");
    expect(result.error).toBeNull();
    expect(result.steps).toBe(2);
    expect(result.toolCalls).toEqual([{ tool: "read_file", ok: true }]);

    // L'observation du premier appel est visible au second tour.
    const second = provider.seen[1]?.messages ?? [];
    expect(
      second.some((message) => message.content.includes("OBSERVATION"))
    ).toBe(true);
    expect(
      second.some((message) => message.content.includes("42"))
    ).toBe(true);
  });

  it("recovers from unknown tools and invalid formats", async () => {
    const ctx = await sandbox();
    const provider = new ScriptedProvider([
      'ACTION: {"tool": "teleport", "args": {}}',
      "just chatting",
      "FINAL: Done anyway.",
    ]);

    const result = await runReasoningLoop({
      provider,
      profile: makeProfile(),
      missionPrompt: "Do it.",
      tools: [createReadFileTool()],
      toolContext: ctx,
    });

    expect(result.completed).toBe(true);
    expect(result.steps).toBe(3);
    expect(result.toolCalls).toEqual([]);

    const contents = provider.seen.flatMap((request) =>
      request.messages.map((message) => message.content)
    );
    expect(contents.some((text) => text.includes("unknown tool"))).toBe(true);
    expect(
      contents.some((text) =>
        text.includes('must contain "ACTION:" or "FINAL:"')
      )
    ).toBe(true);
  });

  it("surfaces tool errors as observations", async () => {
    const ctx = await sandbox();
    const provider = new ScriptedProvider([
      'ACTION: {"tool": "read_file", "args": {"path": "missing.txt"}}',
      "FINAL: File absent.",
    ]);

    const result = await runReasoningLoop({
      provider,
      profile: makeProfile(),
      missionPrompt: "Read it.",
      tools: [createReadFileTool()],
      toolContext: ctx,
    });

    expect(result.completed).toBe(true);
    expect(result.toolCalls).toEqual([{ tool: "read_file", ok: false }]);

    const contents = provider.seen[1]?.messages.map((m) => m.content) ?? [];
    expect(
      contents.some((text) => text.includes("read_file error"))
    ).toBe(true);
  });

  it("survives tools that throw instead of returning", async () => {
    const ctx = await sandbox();
    const provider = new ScriptedProvider([
      'ACTION: {"tool": "boom", "args": {}}',
      "FINAL: Recovered.",
    ]);

    const result = await runReasoningLoop({
      provider,
      profile: makeProfile(),
      missionPrompt: "Go.",
      tools: [throwingTool()],
      toolContext: ctx,
    });

    expect(result.completed).toBe(true);
    expect(result.toolCalls).toEqual([{ tool: "boom", ok: false }]);

    const contents = provider.seen[1]?.messages.map((m) => m.content) ?? [];
    expect(contents.some((text) => text.includes("kaboom"))).toBe(true);
  });

  it("fails after maxSteps without FINAL", async () => {
    const ctx = await sandbox();

    const result = await runReasoningLoop({
      provider: new ScriptedProvider(["nope", "nope", "nope", "nope"]),
      profile: makeProfile(),
      missionPrompt: "Do it.",
      tools: [createReadFileTool()],
      toolContext: ctx,
      maxSteps: 3,
    });

    expect(result.completed).toBe(false);
    expect(result.reportContent).toBeNull();
    expect(result.steps).toBe(3);
    expect(result.error).toContain("3 steps");
  });

  it("aborts on LLM failure", async () => {
    const ctx = await sandbox();

    const result = await runReasoningLoop({
      provider: new FailingProvider(),
      profile: makeProfile(),
      missionPrompt: "Do it.",
      tools: [createReadFileTool()],
      toolContext: ctx,
    });

    expect(result.completed).toBe(false);
    expect(result.error).toBe("LLM timeout");
    expect(result.steps).toBe(0);
  });

  it("creates the sandbox directory and truncates observations", async () => {
    const root = await mkdtemp(join(tmpdir(), "emp-loop-"));
    dir = root;
    const nested = join(root, "deep", "work");
    const provider = new ScriptedProvider([
      'ACTION: {"tool": "noise", "args": {}}',
      "FINAL: Done.",
    ]);

    const result = await runReasoningLoop({
      provider,
      profile: makeProfile(),
      missionPrompt: "Be noisy.",
      tools: [noisyTool()],
      toolContext: { sandboxRoot: nested },
    });

    expect(result.completed).toBe(true);
    await expect(stat(nested)).resolves.toBeTruthy();

    const contents = provider.seen[1]?.messages.map((m) => m.content) ?? [];
    expect(contents.some((text) => text.includes("[truncated]"))).toBe(true);
  });

  it("stops before any LLM call when already cancelled", async () => {
    const provider = new ScriptedProvider(["FINAL: Never reached."]);
    const signal = new InMemoryJobSignal();
    signal.cancel();

    const result = await runReasoningLoop({
      provider,
      profile: makeProfile(),
      missionPrompt: "Do work.",
      signal,
    });

    expect(result.completed).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(result.error).toBe("cancelled");
    expect(result.steps).toBe(0);
    expect(provider.seen).toHaveLength(0);
  });

  it("tracks unknown tools distinctly in encounter order", async () => {
    const provider = new ScriptedProvider([
      'ACTION: {"tool": "run_shell", "args": {"command": "ls"}}',
      'ACTION: {"tool": "teleport", "args": {}}',
      'ACTION: {"tool": "run_shell", "args": {"command": "pwd"}}',
      "FINAL: Done.",
    ]);

    const result = await runReasoningLoop({
      provider,
      profile: makeProfile(),
      missionPrompt: "Do it.",
      tools: [createReadFileTool()],
      toolContext: { sandboxRoot: tmpdir() },
    });

    expect(result.completed).toBe(true);
    expect(result.unknownTools).toEqual(["run_shell", "teleport"]);
    expect(result.toolCalls).toEqual([]);
  });

  it("completes missions with chatty model replies", async () => {
    const provider = new ScriptedProvider([
      'Je lis le fichier.ACTION: {"tool": "read_file", "args": {"path": "a.txt"}}',
      "C'est lu, voici mon rapport.\nFINAL: File contains hello.",
    ]);

    const result = await runReasoningLoop({
      provider,
      profile: makeProfile(),
      missionPrompt: "Read a.txt.",
      tools: [createReadFileTool()],
      toolContext: { sandboxRoot: tmpdir() },
    });

    expect(result.completed).toBe(true);
    expect(result.reportContent).toBe("File contains hello.");
    expect(result.toolCalls).toHaveLength(1);
  });

  it("interrupts mid-run without new calls or tools", async () => {
    const provider = new ScriptedProvider([
      'ACTION: {"tool": "noise", "args": {}}',
      "FINAL: Never reached.",
    ]);
    // Bascule apres le premier pas : un appel LLM + un outil passent.
    let checks = 0;
    const flipping = {
      isCancelled: () => {
        checks += 1;
        return checks > 1;
      },
    };

    const result = await runReasoningLoop({
      provider,
      profile: makeProfile(),
      missionPrompt: "Do work.",
      tools: [noisyTool()],
      toolContext: { sandboxRoot: tmpdir() },
      signal: flipping,
    });

    expect(result.cancelled).toBe(true);
    expect(result.error).toBe("cancelled");
    expect(result.toolCalls).toHaveLength(1);
    expect(provider.seen).toHaveLength(1);
  });
});

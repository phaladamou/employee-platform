import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InMemoryJobSignal } from "../jobs/job-signal";
import { createEmployeeProfile } from "../profile/employee-profile";
import { createEmployeeMission } from "../missions/employee-mission";
import { createReadFileTool } from "../tools/read-file";
import { createWriteFileTool } from "../tools/write-file";
import type { ToolContext } from "../tools/tool";
import { EmployeeRuntime } from "./employee-runtime";
import { FetchLLMProvider } from "./fetch-llm-provider";
import type {
  EmployeeLLMProvider,
  EmployeeLLMRequest,
  EmployeeLLMResponse,
} from "./llm-provider";

function makeProfile() {
  return createEmployeeProfile({
    id: "emp_1",
    name: "Aria",
    role: "Data Analyst",
    skills: ["SQL"],
  });
}

function makeMission() {
  return createEmployeeMission({ prompt: "Audit churn" });
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

describe("EmployeeRuntime.run", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function sandbox(): Promise<ToolContext> {
    dir = await mkdtemp(join(tmpdir(), "emp-runtime-"));
    return { sandboxRoot: dir };
  }

  it("runs a mission and produces a report", async () => {
    const provider = new ScriptedProvider(["FINAL: Churn is seasonal."]);
    const runtime = new EmployeeRuntime(provider, {
      tools: [],
      toolContext: await sandbox(),
    });

    const result = await runtime.run(makeProfile(), makeMission());

    expect(result.error).toBeNull();
    expect(result.profile.status).toBe("idle");
    expect(result.mission.status).toBe("completed");
    expect(result.mission.employeeId).toBe("emp_1");
    expect(result.report?.summary).toBe("Churn is seasonal.");
    expect(result.report?.content).toBe("Churn is seasonal.");
    expect(result.steps).toBe(1);

    const systemPrompt = provider.seen[0]?.messages[0]?.content ?? "";
    expect(systemPrompt).toContain("Aria");
    expect(systemPrompt).toContain("Data Analyst");
  });

  it("uses tools through the reasoning loop", async () => {
    const ctx = await sandbox();
    await writeFile(join(dir, "sales.txt"), "Q1: 42", "utf8");
    const provider = new ScriptedProvider([
      'ACTION: {"tool": "read_file", "args": {"path": "sales.txt"}}',
      "FINAL: Sales reached 42 in Q1.",
    ]);
    const runtime = new EmployeeRuntime(provider, {
      tools: [createReadFileTool()],
      toolContext: ctx,
    });

    const result = await runtime.run(makeProfile(), makeMission());

    expect(result.error).toBeNull();
    expect(result.mission.status).toBe("completed");
    expect(result.report?.summary).toBe("Sales reached 42 in Q1.");
    expect(result.toolCalls).toEqual([{ tool: "read_file", ok: true }]);
    expect(result.steps).toBe(2);
  });

  it("restores idle and fails the mission when the LLM fails", async () => {
    const runtime = new EmployeeRuntime(new FailingProvider(), {
      tools: [],
      toolContext: await sandbox(),
    });

    const result = await runtime.run(makeProfile(), makeMission());

    expect(result.error).toBe("LLM timeout");
    expect(result.report).toBeNull();
    expect(result.profile.status).toBe("idle");
    expect(result.mission.status).toBe("failed");
  });

  it("fails the mission when the loop never finishes", async () => {
    const runtime = new EmployeeRuntime(
      new ScriptedProvider(["nope", "nope", "nope", "nope"]),
      { tools: [], toolContext: await sandbox(), maxSteps: 3 }
    );

    const result = await runtime.run(makeProfile(), makeMission());

    expect(result.mission.status).toBe("failed");
    expect(result.profile.status).toBe("idle");
    expect(result.error).toContain("3 steps");
    expect(result.report).toBeNull();
  });

  it("rejects suspended profiles and foreign missions", async () => {
    const runtime = new EmployeeRuntime(new ScriptedProvider(["FINAL: ok"]), {
      tools: [],
      toolContext: await sandbox(),
    });
    const profile = makeProfile();

    await expect(
      runtime.run(
        { ...profile, status: "suspended" },
        makeMission()
      )
    ).rejects.toThrow();

    const foreign = {
      ...makeMission(),
      employeeId: "emp_other",
    };
    await expect(runtime.run(profile, foreign)).rejects.toThrow();
  });

  it("reports cancellation distinctly from failure", async () => {
    const provider = new ScriptedProvider(["FINAL: Never reached."]);
    const signal = new InMemoryJobSignal();
    signal.cancel();
    const runtime = new EmployeeRuntime(provider, {
      tools: [],
      toolContext: await sandbox(),
      signal,
    });

    const result = await runtime.run(makeProfile(), makeMission());

    expect(result.cancelled).toBe(true);
    expect(result.error).toBe("cancelled");
    expect(result.mission.status).toBe("failed");
    expect(result.profile.status).toBe("idle");
    expect(provider.seen).toHaveLength(0);
  });

  it("reports cancelled false on normal runs", async () => {
    const provider = new ScriptedProvider(["FINAL: Done."]);
    const runtime = new EmployeeRuntime(provider, {
      tools: [],
      toolContext: await sandbox(),
    });

    const result = await runtime.run(makeProfile(), makeMission());

    expect(result.cancelled).toBe(false);
    expect(result.error).toBeNull();
  });

  it("fails missions whose acceptance criteria are unmet", async () => {
    const provider = new ScriptedProvider(["FINAL: File created, trust me."]);
    const runtime = new EmployeeRuntime(provider, {
      tools: [],
      toolContext: await sandbox(),
    });
    const mission = createEmployeeMission({
      prompt: "Create hello.txt",
      acceptance: { files: [{ path: "hello.txt", contains: "hi" }] },
    });

    const result = await runtime.run(makeProfile(), mission);

    expect(result.mission.status).toBe("failed");
    expect(result.error).toContain("verification failed");
    expect(result.error).toContain("hello.txt");
    expect(result.report).toBeNull();
    expect(result.needsReview).toBe(false);
  });

  it("succeeds missions whose acceptance criteria hold", async () => {
    const provider = new ScriptedProvider([
      'ACTION: {"tool": "write_file", "args": {"path": "hello.txt", "content": "hi"}}',
      "FINAL: Created.",
    ]);
    const ctx = await sandbox();
    const runtime = new EmployeeRuntime(provider, {
      tools: [createWriteFileTool()],
      toolContext: ctx,
    });
    const mission = createEmployeeMission({
      prompt: "Create hello.txt",
      acceptance: { files: [{ path: "hello.txt", contains: "hi" }] },
    });

    const result = await runtime.run(makeProfile(), mission);

    expect(result.mission.status).toBe("completed");
    expect(result.error).toBeNull();
  });

  it("flags for review when reaching outside the profile with nothing done", async () => {
    const provider = new ScriptedProvider([
      'ACTION: {"tool": "run_shell", "args": {"command": "touch x"}}',
      "FINAL: All done.",
    ]);
    const runtime = new EmployeeRuntime(provider, {
      tools: [createReadFileTool()],
      toolContext: await sandbox(),
    });

    const result = await runtime.run(makeProfile(), makeMission());

    expect(result.needsReview).toBe(true);
    expect(result.reviewReason).toContain("run_shell");
    expect(result.mission.status).toBe("needs_review");
    expect(result.report?.content).toBe("All done.");
    expect(result.error).toBeNull();
    expect(result.cancelled).toBe(false);
  });

  it("trusts clean runs without criteria or signals", async () => {
    const provider = new ScriptedProvider(["FINAL: Answered from knowledge."]);
    const runtime = new EmployeeRuntime(provider, {
      tools: [],
      toolContext: await sandbox(),
    });

    const result = await runtime.run(makeProfile(), makeMission());

    expect(result.mission.status).toBe("completed");
    expect(result.needsReview).toBe(false);
  });

  it("succeeds when the agent adapts after an unknown attempt", async () => {
    const provider = new ScriptedProvider([
      'ACTION: {"tool": "run_shell", "args": {"command": "ls"}}',
      'ACTION: {"tool": "read_file", "args": {"path": "sales.txt"}}',
      "FINAL: Read it.",
    ]);
    const ctx = await sandbox();
    await writeFile(join(dir, "sales.txt"), "Q1: 42", "utf8");
    const runtime = new EmployeeRuntime(provider, {
      tools: [createReadFileTool()],
      toolContext: ctx,
    });

    const result = await runtime.run(makeProfile(), makeMission());

    expect(result.mission.status).toBe("completed");
    expect(result.needsReview).toBe(false);
  });
});

describe("FetchLLMProvider", () => {
  it("requires apiKey, baseUrl and model", () => {
    expect(
      () =>
        new FetchLLMProvider({ apiKey: "", baseUrl: "https://x", model: "m" })
    ).toThrow();
    expect(
      () =>
        new FetchLLMProvider({ apiKey: "k", baseUrl: "", model: "m" })
    ).toThrow();
    expect(
      () =>
        new FetchLLMProvider({ apiKey: "k", baseUrl: "https://x", model: "" })
    ).toThrow();
  });

  it("posts a chat completion and returns its content", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        model: "deepseek-chat",
        choices: [{ message: { content: "Hello report" } }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      const provider = new FetchLLMProvider({
        apiKey: "key",
        baseUrl: "https://api.deepseek.com/",
        model: "deepseek-chat",
      });
      const response = await provider.generate({
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(response).toEqual({
        content: "Hello report",
        model: "deepseek-chat",
      });
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.deepseek.com/chat/completions");
      expect(init.method).toBe("POST");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("throws on HTTP errors and empty responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 }))
    );
    const provider = new FetchLLMProvider({
      apiKey: "key",
      baseUrl: "https://x",
      model: "m",
    });

    try {
      await expect(
        provider.generate({ messages: [{ role: "user", content: "Hi" }] })
      ).rejects.toThrow("HTTP 500");
    } finally {
      vi.unstubAllGlobals();
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: {} }] }),
      }))
    );

    try {
      await expect(
        provider.generate({ messages: [{ role: "user", content: "Hi" }] })
      ).rejects.toThrow("empty response");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEmployeeProfile } from "../profile/employee-profile";
import { createEmployeeMission } from "../missions/employee-mission";
import { createReadFileTool } from "../tools/read-file";
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

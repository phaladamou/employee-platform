import { describe, expect, it, vi } from "vitest";

import { createEmployeeProfile } from "../profile/employee-profile";
import { createEmployeeMission } from "../missions/employee-mission";
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

class FakeProvider implements EmployeeLLMProvider {
  readonly id = "fake";
  readonly seen: EmployeeLLMRequest[] = [];

  constructor(private readonly text: string) {}

  async generate(request: EmployeeLLMRequest): Promise<EmployeeLLMResponse> {
    this.seen.push(request);
    return { content: this.text, model: "fake-model" };
  }
}

class FailingProvider implements EmployeeLLMProvider {
  readonly id = "failing";

  async generate(): Promise<EmployeeLLMResponse> {
    throw new Error("LLM timeout");
  }
}

describe("EmployeeRuntime.run", () => {
  it("runs a mission and produces a report", async () => {
    const provider = new FakeProvider("Churn is seasonal.\nDetails...");
    const runtime = new EmployeeRuntime(provider);

    const result = await runtime.run(makeProfile(), makeMission());

    expect(result.error).toBeNull();
    expect(result.profile.status).toBe("idle");
    expect(result.mission.status).toBe("completed");
    expect(result.mission.employeeId).toBe("emp_1");
    expect(result.report?.summary).toBe("Churn is seasonal.");
    expect(result.report?.content).toBe("Churn is seasonal.\nDetails...");

    const systemPrompt = provider.seen[0]?.messages[0]?.content ?? "";
    expect(systemPrompt).toContain("Aria");
    expect(systemPrompt).toContain("Data Analyst");
  });

  it("restores idle and fails the mission when the LLM fails", async () => {
    const runtime = new EmployeeRuntime(new FailingProvider());

    const result = await runtime.run(makeProfile(), makeMission());

    expect(result.error).toBe("LLM timeout");
    expect(result.report).toBeNull();
    expect(result.profile.status).toBe("idle");
    expect(result.mission.status).toBe("failed");
  });

  it("rejects suspended profiles and foreign missions", async () => {
    const runtime = new EmployeeRuntime(new FakeProvider("ok"));
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

import { afterEach, describe, expect, it, vi } from "vitest";

import type { EmployeeLLMRequest } from "./llm-provider";
import { FetchLLMProvider } from "./fetch-llm-provider";

const REQUEST: EmployeeLLMRequest = {
  messages: [{ role: "user", content: "Hi." }],
};

function stubFetch(payload: unknown, status = 200) {
  const fetchImpl = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }));
  vi.stubGlobal("fetch", fetchImpl);
  return fetchImpl;
}

function provider() {
  return new FetchLLMProvider({
    apiKey: "key",
    baseUrl: "http://llm",
    model: "test-model",
  });
}

function completion(usage?: unknown) {
  return {
    choices: [{ message: { content: "FINAL: Done." } }],
    model: "test-model",
    ...(usage === undefined ? {} : { usage }),
  };
}

describe("FetchLLMProvider usage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps OpenAI-style usage to token counters", async () => {
    stubFetch(
      completion({ prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 })
    );
    const response = await provider().generate(REQUEST);
    expect(response.usage).toEqual({
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
    });
  });

  it("omits usage when the provider reports none", async () => {
    stubFetch(completion());
    const response = await provider().generate(REQUEST);
    expect(response.usage).toBeUndefined();
    expect("usage" in response).toBe(false);
  });

  it("drops invalid usage fields instead of inventing zeros", async () => {
    stubFetch(
      completion({
        prompt_tokens: 120,
        completion_tokens: "a lot",
        total_tokens: -5,
      })
    );
    const response = await provider().generate(REQUEST);
    expect(response.usage).toEqual({ inputTokens: 120 });
  });

  it("omits usage when every field is invalid", async () => {
    stubFetch(completion({ prompt_tokens: "many" }));
    const response = await provider().generate(REQUEST);
    expect(response.usage).toBeUndefined();
  });
});

describe("FetchLLMProvider generateStream", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
  }

  function stubStreamFetch(chunks: string[], status = 200) {
    const fetchImpl = vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      body: sseBody(chunks),
    }));
    vi.stubGlobal("fetch", fetchImpl);
    return fetchImpl;
  }

  function delta(text: string): string {
    return `data: {"choices":[{"delta":{"content":"${text}"}}]}\n\n`;
  }

  it("requests stream:true and forwards text incrementally", async () => {
    const fetchImpl = stubStreamFetch([
      delta("Hel"),
      delta("lo"),
      "data: [DONE]\n\n",
    ]);
    const seen: string[] = [];
    const response = await provider().generateStream(REQUEST, (text) => {
      seen.push(text);
    });

    expect(response.content).toBe("Hello");
    expect(seen.join("")).toBe("Hello");
    expect(seen.length).toBeGreaterThanOrEqual(2);
    const sent = JSON.parse(
      (fetchImpl.mock.calls[0]?.[1] as { body: string }).body
    ) as { stream?: unknown };
    expect(sent.stream).toBe(true);
  });

  it("resolves without usage counters in stream mode", async () => {
    stubStreamFetch([delta("Hi"), "data: [DONE]\n\n"]);
    const response = await provider().generateStream(REQUEST, () => {});
    expect(response.content).toBe("Hi");
    expect("usage" in response).toBe(false);
  });

  it("rejects HTTP errors and empty streams like generate()", async () => {
    stubStreamFetch([], 500);
    await expect(provider().generateStream(REQUEST, () => {})).rejects.toThrow(
      "HTTP 500"
    );

    stubStreamFetch(["data: [DONE]\n\n"]);
    await expect(provider().generateStream(REQUEST, () => {})).rejects.toThrow(
      "empty response"
    );
  });
});

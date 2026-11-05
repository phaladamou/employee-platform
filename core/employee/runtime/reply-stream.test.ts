import { describe, expect, it } from "vitest";

import type {
  EmployeeLLMProvider,
  EmployeeLLMRequest,
  EmployeeLLMResponse,
} from "./llm-provider";
import { generateReplyText } from "./reply-stream";

const REQUEST: EmployeeLLMRequest = {
  messages: [{ role: "user", content: "Hi." }],
};

class StreamingProvider implements EmployeeLLMProvider {
  readonly id = "streaming";
  readonly chunks: string[];
  generateCalls = 0;
  streamCalls = 0;

  constructor(chunks: string[]) {
    this.chunks = chunks;
  }

  async generate(): Promise<EmployeeLLMResponse> {
    this.generateCalls += 1;
    return { content: this.chunks.join(""), model: "streaming" };
  }

  async generateStream(
    _request: EmployeeLLMRequest,
    onToken: (text: string) => void | Promise<void>
  ): Promise<EmployeeLLMResponse> {
    this.streamCalls += 1;
    for (const chunk of this.chunks) {
      await onToken(chunk);
    }
    return { content: this.chunks.join(""), model: "streaming" };
  }
}

class BlockingProvider implements EmployeeLLMProvider {
  readonly id = "blocking";

  async generate(): Promise<EmployeeLLMResponse> {
    return { content: "Hello.", model: "blocking" };
  }
}

describe("generateReplyText", () => {
  it("streams chunks when the provider supports it", async () => {
    const provider = new StreamingProvider(["Hel", "lo."]);
    const seen: string[] = [];
    const text = await generateReplyText(provider, REQUEST, (chunk) => {
      seen.push(chunk);
    });

    expect(text).toBe("Hello.");
    expect(seen).toEqual(["Hel", "lo."]);
    expect(provider.streamCalls).toBe(1);
    expect(provider.generateCalls).toBe(0);
  });

  it("emits one token on providers without streaming", async () => {
    const seen: string[] = [];
    const text = await generateReplyText(new BlockingProvider(), REQUEST, (chunk) => {
      seen.push(chunk);
    });

    expect(text).toBe("Hello.");
    expect(seen).toEqual(["Hello."]);
  });

  it("calls generate without tokens when no listener is given", async () => {
    const provider = new StreamingProvider(["Hel", "lo."]);
    const text = await generateReplyText(provider, REQUEST);

    expect(text).toBe("Hello.");
    expect(provider.generateCalls).toBe(1);
    expect(provider.streamCalls).toBe(0);
  });
});

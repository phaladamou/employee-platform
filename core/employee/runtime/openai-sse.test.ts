import { describe, expect, it } from "vitest";

import { parseOpenAIStreamLine, pipeSSEToText } from "./openai-sse";

function fakeStream(fragments: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const fragment of fragments) {
        controller.enqueue(encoder.encode(fragment));
      }
      controller.close();
    },
  });
}

async function readChunks(
  stream: ReadableStream<Uint8Array>
): Promise<string[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return chunks;
    }
    chunks.push(decoder.decode(value));
  }
}

describe("parseOpenAIStreamLine", () => {
  it("extracts delta content", () => {
    const line = 'data: {"choices":[{"delta":{"content":"Hello"}}]}';
    expect(parseOpenAIStreamLine(line)).toEqual({
      done: false,
      text: "Hello",
    });
  });

  it("signals completion on [DONE]", () => {
    expect(parseOpenAIStreamLine("data: [DONE]")).toEqual({
      done: true,
      text: "",
    });
  });

  it("ignores non-data lines", () => {
    expect(parseOpenAIStreamLine(": ping")).toEqual({
      done: false,
      text: "",
    });
    expect(parseOpenAIStreamLine("")).toEqual({ done: false, text: "" });
  });

  it("ignores malformed payloads without stopping", () => {
    expect(parseOpenAIStreamLine("data: not-json")).toEqual({
      done: false,
      text: "",
    });
    expect(parseOpenAIStreamLine('data: {"choices":[]}')).toEqual({
      done: false,
      text: "",
    });
  });

  it("stops on upstream error payloads", () => {
    const line = 'data: {"error":{"message":"overloaded"}}';
    expect(parseOpenAIStreamLine(line)).toEqual({ done: true, text: "" });
  });
});

describe("pipeSSEToText", () => {
  it("emits text incrementally across fragmented chunks", async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n' +
      "data: [DONE]\n\n";
    const fragments = [sse.slice(0, 20), sse.slice(20, 60), sse.slice(60)];
    const chunks = await readChunks(pipeSSEToText(fakeStream(fragments)));
    expect(chunks.join("")).toBe("Hello");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("ignores everything after [DONE]", async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"A"}}]}\n\n' +
      "data: [DONE]\n\n" +
      'data: {"choices":[{"delta":{"content":"B"}}]}\n\n';
    const chunks = await readChunks(pipeSSEToText(fakeStream([sse])));
    expect(chunks.join("")).toBe("A");
  });

  it("stops the text on upstream error payloads", async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"A"}}]}\n\n' +
      'data: {"error":{"message":"overloaded"}}\n\n';
    const chunks = await readChunks(pipeSSEToText(fakeStream([sse])));
    expect(chunks.join("")).toBe("A");
  });
});

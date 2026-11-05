// lib/server/sse-parse.test.ts
// Contrat du parseur de stream OpenAI (lignes "data: ...").
// Execution : node --test lib/server/sse-parse.test.ts
// (fonctions pures uniquement : jamais d'appel LLM ici).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseOpenAIStreamLine, pipeSSEToText } from "./sse-parse.ts";

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
    assert.deepEqual(parseOpenAIStreamLine(line), {
      done: false,
      text: "Hello",
    });
  });

  it("signals completion on [DONE]", () => {
    assert.deepEqual(parseOpenAIStreamLine("data: [DONE]"), {
      done: true,
      text: "",
    });
  });

  it("ignores non-data lines", () => {
    assert.deepEqual(parseOpenAIStreamLine(": ping"), {
      done: false,
      text: "",
    });
    assert.deepEqual(parseOpenAIStreamLine(""), { done: false, text: "" });
  });

  it("ignores malformed payloads without stopping", () => {
    assert.deepEqual(parseOpenAIStreamLine("data: not-json"), {
      done: false,
      text: "",
    });
    assert.deepEqual(parseOpenAIStreamLine('data: {"choices":[]}'), {
      done: false,
      text: "",
    });
  });

  it("stops on upstream error payloads", () => {
    const line = 'data: {"error":{"message":"overloaded"}}';
    assert.deepEqual(parseOpenAIStreamLine(line), {
      done: true,
      text: "",
    });
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
    assert.equal(chunks.join(""), "Hello");
    assert.ok(chunks.length >= 2, `expected >= 2 chunks, got ${chunks.length}`);
  });

  it("ignores everything after [DONE]", async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"A"}}]}\n\n' +
      "data: [DONE]\n\n" +
      'data: {"choices":[{"delta":{"content":"B"}}]}\n\n';
    const chunks = await readChunks(pipeSSEToText(fakeStream([sse])));
    assert.equal(chunks.join(""), "A");
  });

  it("stops the text on upstream error payloads", async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"A"}}]}\n\n' +
      'data: {"error":{"message":"overloaded"}}\n\n';
    const chunks = await readChunks(pipeSSEToText(fakeStream([sse])));
    assert.equal(chunks.join(""), "A");
  });
});

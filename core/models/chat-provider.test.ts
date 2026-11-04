// core/models/chat-provider.test.ts
// Contrat du fournisseur LLM unique (Muse).
// Execution : node --test core/models/chat-provider.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveChatLLM } from "./chat-provider.ts";

describe("chat provider", () => {
  it("resolves Muse defaults", () => {
    assert.deepEqual(resolveChatLLM({ MUSE_API_KEY: "k" }), {
      baseURL: "https://api.meta.ai/v1",
      apiKey: "k",
      model: "muse-spark-1.3",
      reasoningEffort: "minimal",
    });
  });

  it("honors MUSE_* overrides", () => {
    assert.deepEqual(
      resolveChatLLM({
        MUSE_API_KEY: "k",
        MUSE_BASE_URL: "https://muse.local/v1",
        MUSE_MODEL: "muse-x",
        MUSE_REASONING_EFFORT: "high",
      }),
      {
        baseURL: "https://muse.local/v1",
        apiKey: "k",
        model: "muse-x",
        reasoningEffort: "high",
      }
    );
  });

  it("fails clearly when the key is missing", () => {
    assert.throws(() => resolveChatLLM({}), /MUSE_API_KEY/);
  });

  it("fails clearly on unknown reasoning effort", () => {
    assert.throws(
      () =>
        resolveChatLLM({
          MUSE_API_KEY: "k",
          MUSE_REASONING_EFFORT: "none",
        }),
      /MUSE_REASONING_EFFORT/
    );
  });
});

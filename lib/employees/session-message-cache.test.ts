// lib/employees/session-message-cache.test.ts
// Execution : node --test lib/employees/session-message-cache.test.ts
// (fonctions pures uniquement : jamais d'appel LLM ici).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  cacheSessionMessages,
  readSessionMessages,
} from "./session-message-cache.ts";
import type { SessionHistoryMessage } from "./session-history.ts";

function message(id: string, text = id): SessionHistoryMessage {
  return { id, role: "user", text };
}

describe("session-message-cache", () => {
  it("round-trips visible messages per employee and session", () => {
    cacheSessionMessages("emp", "s1", [message("a"), message("b")]);

    assert.deepEqual(readSessionMessages("emp", "s1"), [
      message("a"),
      message("b"),
    ]);
  });

  it("misses on unknown sessions or employees", () => {
    assert.equal(readSessionMessages("emp", "nope"), null);
    assert.equal(readSessionMessages("nope", "s1"), null);
  });

  it("ignores empty lists", () => {
    cacheSessionMessages("emp", "empty", []);

    assert.equal(readSessionMessages("emp", "empty"), null);
  });

  it("isolates callers from the stored copy", () => {
    const stored = [message("a")];
    cacheSessionMessages("emp", "iso", stored);
    stored.push(message("mutated"));

    const read = readSessionMessages("emp", "iso");
    assert.deepEqual(read, [message("a")]);
    read?.push(message("mutated-again"));

    assert.deepEqual(readSessionMessages("emp", "iso"), [message("a")]);
  });

  it("evicts the oldest sessions beyond the bound", () => {
    for (let index = 0; index < 12; index += 1) {
      cacheSessionMessages("emp", `evict-${index}`, [message("x")]);
    }

    assert.equal(readSessionMessages("emp", "evict-0"), null);
    assert.equal(readSessionMessages("emp", "evict-1"), null);
    assert.deepEqual(readSessionMessages("emp", "evict-11"), [message("x")]);
  });
});

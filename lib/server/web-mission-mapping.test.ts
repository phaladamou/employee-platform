// lib/server/web-mission-mapping.test.ts
// Execution : node --test lib/server/web-mission-mapping.test.ts
// (fonctions pures uniquement : jamais d'appel LLM ici).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  formatToolCalls,
  resolveSpecialization,
  shouldAnswerDirectly,
  toWebStatus,
} from "./web-mission-mapping.ts";

describe("toWebStatus", () => {
  it("maps kernel statuses to web statuses", () => {
    assert.equal(toWebStatus("completed"), "succeeded");
    assert.equal(toWebStatus("failed"), "failed");
    assert.equal(toWebStatus("needs_review"), "needs_review");
    assert.equal(toWebStatus("running"), "running");
    assert.equal(toWebStatus("pending"), "queued");
  });
});

describe("formatToolCalls", () => {
  it("flags answers without tool calls", () => {
    assert.equal(
      formatToolCalls([]),
      "Tools used: none (the employee answered without calling tools)."
    );
  });

  it("lists calls with their status", () => {
    assert.equal(
      formatToolCalls([
        { tool: "github_clone", ok: true },
        { tool: "read_file", ok: true },
        { tool: "github_push", ok: false },
      ]),
      "Tools used: github_clone (ok), read_file (ok), github_push (failed)."
    );
  });

  it("caps long traces", () => {
    const calls = Array.from({ length: 15 }, (_, i) => ({
      tool: `tool_${i}`,
      ok: true,
    }));
    const line = formatToolCalls(calls);
    assert.ok(line.includes("tool_0 (ok)"));
    assert.ok(!line.includes("tool_12"));
    assert.ok(line.endsWith("(+3 more)."));
  });
});

describe("resolveSpecialization", () => {
  it("binds talent spec and version", () => {
    assert.deepEqual(
      resolveSpecialization({
        talentSpec: "atlas-software-engineer",
        specVersion: "1.0.0",
      }),
      { name: "atlas-software-engineer", version: "1.0.0" }
    );
  });

  it("returns null without a bound spec (Chef, legacy)", () => {
    assert.equal(
      resolveSpecialization({ talentSpec: null, specVersion: null }),
      null
    );
    assert.equal(
      resolveSpecialization({ talentSpec: "x", specVersion: null }),
      null
    );
    assert.equal(
      resolveSpecialization({ talentSpec: null, specVersion: "1.0.0" }),
      null
    );
  });
});

describe("shouldAnswerDirectly", () => {
  it("routes conversational prompts to a direct reply", () => {
    assert.equal(
      shouldAnswerDirectly({ forceMission: false, conversational: true }),
      true
    );
  });

  it("forces missions on demand or on mission-like prompts", () => {
    assert.equal(
      shouldAnswerDirectly({ forceMission: true, conversational: true }),
      false
    );
    assert.equal(
      shouldAnswerDirectly({ forceMission: false, conversational: false }),
      false
    );
    assert.equal(
      shouldAnswerDirectly({ forceMission: true, conversational: false }),
      false
    );
  });
});

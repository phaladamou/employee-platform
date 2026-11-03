// lib/server/employee-conversation-mapping.test.ts
// Execution : node --test lib/server/employee-conversation-mapping.test.ts
// (fonctions pures uniquement : jamais d'acces DB ici).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  partsToText,
  textToParts,
  toDisplayRole,
  toStoredRole,
  toStoredToolCalls,
  toToolCallRecords,
} from "./employee-conversation-mapping.ts";

describe("chat roles", () => {
  it("maps display roles to stored roles", () => {
    assert.equal(toStoredRole("user"), "user");
    assert.equal(toStoredRole("employee"), "assistant");
  });

  it("maps stored roles back to display roles", () => {
    assert.equal(toDisplayRole("user"), "user");
    assert.equal(toDisplayRole("assistant"), "employee");
    assert.equal(toDisplayRole("system"), "user");
  });
});

describe("message parts", () => {
  it("wraps text in a single text part", () => {
    assert.deepEqual(textToParts("hello"), [{ type: "text", text: "hello" }]);
  });

  it("extracts text back from parts", () => {
    assert.equal(partsToText([{ type: "text", text: "hello" }]), "hello");
    assert.equal(
      partsToText([
        { type: "text", text: "a" },
        { type: "image", url: "x" },
        { type: "text", text: "b" },
      ]),
      "ab"
    );
  });

  it("returns empty text for malformed parts", () => {
    assert.equal(partsToText(null), "");
    assert.equal(partsToText("hello"), "");
    assert.equal(partsToText([{ type: "text" }]), "");
  });
});

describe("tool call records", () => {
  it("normalizes runtime calls to plain records", () => {
    assert.deepEqual(
      toStoredToolCalls([
        { tool: "github_clone", ok: true },
        { tool: "github_push", ok: false },
      ]),
      [
        { tool: "github_clone", ok: true },
        { tool: "github_push", ok: false },
      ]
    );
  });

  it("validates stored JSON back to records", () => {
    assert.deepEqual(
      toToolCallRecords([
        { tool: "github_clone", ok: true },
        { tool: "", ok: true },
        { tool: "x" },
        null,
        "github_clone",
      ]),
      [{ tool: "github_clone", ok: true }]
    );
  });

  it("returns no records for non-array payloads", () => {
    assert.deepEqual(toToolCallRecords(null), []);
    assert.deepEqual(toToolCallRecords({}), []);
    assert.deepEqual(toToolCallRecords("[]"), []);
  });
});

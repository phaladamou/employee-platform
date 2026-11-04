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

  it("round-trips thought time and file changes", () => {
    const calls = [
      {
        tool: "write_file",
        ok: true,
        title: "Ecriture",
        thoughtMs: 8120,
        files: [
          {
            path: "app.js",
            status: "modified" as const,
            added: 1,
            removed: 1,
            rows: [
              {
                type: "del" as const,
                oldNo: 1,
                newNo: null,
                text: "const a = 1;",
              },
              {
                type: "add" as const,
                oldNo: null,
                newNo: 1,
                text: "const a = 2;",
              },
            ],
            truncated: false,
          },
        ],
      },
      { tool: "read_file", ok: true, title: null, thoughtMs: 120 },
    ];
    const stored = toStoredToolCalls(calls);
    assert.deepEqual(stored, [
      {
        tool: "write_file",
        ok: true,
        title: "Ecriture",
        thoughtMs: 8120,
        files: [
          {
            path: "app.js",
            status: "modified",
            added: 1,
            removed: 1,
            rows: [
              {
                type: "del",
                oldNo: 1,
                newNo: null,
                text: "const a = 1;",
              },
              {
                type: "add",
                oldNo: null,
                newNo: 1,
                text: "const a = 2;",
              },
            ],
            truncated: false,
          },
        ],
      },
      { tool: "read_file", ok: true, thoughtMs: 120 },
    ]);
    // Relecture : valide, ignores ciblés (fichier sans chemin,
    // compteur negatif, thoughtMs absurde).
    assert.deepEqual(
      toToolCallRecords([
        ...stored,
        { tool: "write_file", ok: true, thoughtMs: -5, files: [{ path: "" }] },
        { tool: "write_file", ok: true, files: "nope" },
      ]),
      [
        ...stored,
        { tool: "write_file", ok: true, files: [] },
        { tool: "write_file", ok: true },
      ]
    );
  });

  it("round-trips the agent-written step title", () => {
    assert.deepEqual(
      toStoredToolCalls([
        { tool: "github_fork", ok: true, title: "Fork du dépôt" },
        { tool: "read_file", ok: true, title: null },
      ]),
      [
        { tool: "github_fork", ok: true, title: "Fork du dépôt" },
        { tool: "read_file", ok: true },
      ]
    );
    assert.deepEqual(
      toToolCallRecords([
        { tool: "github_fork", ok: true, title: "Fork du dépôt" },
        { tool: "github_fork", ok: true, title: 42 },
        { tool: "read_file", ok: true },
      ]),
      [
        { tool: "github_fork", ok: true, title: "Fork du dépôt" },
        { tool: "github_fork", ok: true },
        { tool: "read_file", ok: true },
      ]
    );
  });
});

// lib/cli/parser.test.ts
// Execution : node --test lib/cli/parser.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseLine, tokenize } from "./parser.ts";

describe("tokenize", () => {
  it("splits on whitespace", () => {
    assert.deepEqual(tokenize("missions 10"), {
      ok: true,
      tokens: ["missions", "10"],
    });
  });

  it("groups double-quoted segments", () => {
    assert.deepEqual(tokenize('submit aria --title "hello world"'), {
      ok: true,
      tokens: ["submit", "aria", "--title", "hello world"],
    });
  });

  it("groups single-quoted segments", () => {
    assert.deepEqual(tokenize("submit aria --title 'hello world'"), {
      ok: true,
      tokens: ["submit", "aria", "--title", "hello world"],
    });
  });

  it("honors backslash escapes", () => {
    assert.deepEqual(tokenize('echo a\\"b c\\ d'), {
      ok: true,
      tokens: ["echo", 'a"b', "c d"],
    });
  });

  it("fails closed on unterminated quote", () => {
    assert.deepEqual(tokenize('submit --title "oops'), {
      ok: false,
      error: "Unterminated quote",
    });
  });
});

describe("parseLine", () => {
  it("lowercases the command name", () => {
    assert.deepEqual(parseLine("STATUS"), {
      ok: true,
      command: { name: "status", args: [], flags: {} },
    });
  });

  it("parses --key value, --key=value and boolean flags", () => {
    assert.deepEqual(
      parseLine("submit aria --title x --expect-file=y --expect-test"),
      {
        ok: true,
        command: {
          name: "submit",
          args: ["aria"],
          flags: { title: "x", "expect-file": "y", "expect-test": true },
        },
      }
    );
  });

  it("treats tokens after -- as args", () => {
    assert.deepEqual(parseLine("missions -- --weird"), {
      ok: true,
      command: { name: "missions", args: ["--weird"], flags: {} },
    });
  });

  it("rejects empty input", () => {
    assert.deepEqual(parseLine("   "), { ok: false, error: "Empty command" });
  });
});

// lib/cli/commands.test.ts
// Execution : node --test lib/cli/commands.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  COMMANDS,
  getCommand,
  helpText,
  parseMissionsArgs,
} from "./commands.ts";

describe("allowlist", () => {
  it("exposes only the documented read commands", () => {
    assert.deepEqual(
      COMMANDS.map((spec) => spec.name),
      ["help", "status", "employees", "missions", "talents"]
    );
    for (const spec of COMMANDS) {
      assert.equal(spec.kind, "read");
    }
  });

  it("returns null for unknown commands", () => {
    assert.equal(getCommand("rm"), null);
    assert.equal(getCommand("shell"), null);
  });
});

describe("helpText", () => {
  it("lists every command without args", () => {
    const text = helpText();
    for (const spec of COMMANDS) {
      assert.match(text, new RegExp(spec.name));
    }
  });

  it("shows single-command usage", () => {
    assert.match(helpText("missions"), /missions \[limit\]/);
  });

  it("fails closed on unknown command", () => {
    assert.match(helpText("rm"), /Unknown command/);
  });
});

describe("parseMissionsArgs", () => {
  it("defaults to 10", () => {
    assert.deepEqual(parseMissionsArgs([]), { ok: true, limit: 10 });
  });

  it("accepts 1..50", () => {
    assert.deepEqual(parseMissionsArgs(["50"]), { ok: true, limit: 50 });
  });

  it("rejects out-of-range and non-numeric limits", () => {
    assert.equal(parseMissionsArgs(["0"]).ok, false);
    assert.equal(parseMissionsArgs(["51"]).ok, false);
    assert.equal(parseMissionsArgs(["many"]).ok, false);
    assert.equal(parseMissionsArgs(["5", "6"]).ok, false);
  });
});

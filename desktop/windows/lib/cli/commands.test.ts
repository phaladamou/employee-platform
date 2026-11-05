// lib/cli/commands.test.ts
// Execution : node --test lib/cli/commands.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  COMMANDS,
  getCommand,
  helpText,
  parseCancelArgs,
  parseHireArgs,
  parseMissionsArgs,
  parseSubmitArgs,
} from "./commands.ts";

describe("allowlist", () => {
  it("exposes exactly the documented commands with their kinds", () => {
    assert.deepEqual(
      COMMANDS.map((spec) => `${spec.name}:${spec.kind}`),
      [
        "help:read",
        "status:read",
        "employees:read",
        "missions:read",
        "talents:read",
        "hire:write",
        "submit:write",
        "cancel:write",
        "confirm:write",
      ]
    );
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

describe("parseHireArgs", () => {
  it("accepts exactly one spec", () => {
    assert.deepEqual(parseHireArgs(["atlas@1.0.0"], {}), {
      ok: true,
      spec: "atlas@1.0.0",
    });
  });

  it("rejects missing, extra, or flagged args", () => {
    assert.equal(parseHireArgs([], {}).ok, false);
    assert.equal(parseHireArgs(["a", "b"], {}).ok, false);
    assert.equal(parseHireArgs(["a"], { force: true }).ok, false);
  });
});

describe("parseCancelArgs", () => {
  it("accepts exactly one mission ref", () => {
    assert.deepEqual(parseCancelArgs(["abc12345"], {}), {
      ok: true,
      missionRef: "abc12345",
    });
  });

  it("rejects missing, extra, or flagged args", () => {
    assert.equal(parseCancelArgs([], {}).ok, false);
    assert.equal(parseCancelArgs(["a", "b"], {}).ok, false);
    assert.equal(parseCancelArgs(["a"], { force: true }).ok, false);
  });
});

describe("parseSubmitArgs", () => {
  it("accepts a full submit line", () => {
    assert.deepEqual(
      parseSubmitArgs(["aria"], {
        title: "Report",
        prompt: "Write it",
        "expect-file": "out.md",
        "expect-test": true,
      }),
      {
        ok: true,
        args: {
          employeeRef: "aria",
          title: "Report",
          prompt: "Write it",
          expectFile: "out.md",
          expectTest: true,
        },
      }
    );
  });

  it("defaults optionals when absent", () => {
    const parsed = parseSubmitArgs(["aria"], { title: "T", prompt: "P" });
    assert.deepEqual(parsed, {
      ok: true,
      args: {
        employeeRef: "aria",
        title: "T",
        prompt: "P",
        expectFile: null,
        expectTest: false,
      },
    });
  });

  it("rejects missing pieces and unknown flags", () => {
    assert.equal(parseSubmitArgs([], { title: "T", prompt: "P" }).ok, false);
    assert.equal(parseSubmitArgs(["a", "b"], { title: "T", prompt: "P" }).ok, false);
    assert.equal(parseSubmitArgs(["aria"], { prompt: "P" }).ok, false);
    assert.equal(parseSubmitArgs(["aria"], { title: "T" }).ok, false);
    assert.equal(
      parseSubmitArgs(["aria"], { title: "T", prompt: "P", sudo: true }).ok,
      false
    );
  });

  it("enforces length caps", () => {
    assert.equal(
      parseSubmitArgs(["aria"], { title: "x".repeat(201), prompt: "P" }).ok,
      false
    );
    assert.equal(
      parseSubmitArgs(["aria"], { title: "T", prompt: "x".repeat(4001) }).ok,
      false
    );
  });
});

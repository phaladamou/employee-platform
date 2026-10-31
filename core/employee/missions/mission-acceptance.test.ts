import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  MAX_ACCEPTANCE_TESTS,
  MAX_TEST_COMMAND_CHARS,
  validateAcceptance,
  verifyAcceptance,
  verifyAcceptanceTests,
} from "./mission-acceptance";

describe("validateAcceptance", () => {
  it("accepts empty and well-formed criteria", () => {
    expect(validateAcceptance(undefined)).toEqual({ files: [] });
    expect(validateAcceptance(null)).toEqual({ files: [] });
    expect(validateAcceptance({ files: [] })).toEqual({ files: [] });
    expect(
      validateAcceptance({
        files: [
          { path: "hello.txt" },
          { path: "sub/report.md", contains: "done" },
        ],
      })
    ).toEqual({
      files: [
        { path: "hello.txt", contains: null },
        { path: "sub/report.md", contains: "done" },
      ],
    });
  });

  it("rejects malformed criteria fail-fast", () => {
    expect(() => validateAcceptance({})).toThrow("requires a files array");
    expect(() => validateAcceptance({ files: [{}] })).toThrow(
      "requires a path string"
    );
    expect(() => validateAcceptance({ files: [{ path: "  " }] })).toThrow(
      "cannot be empty"
    );
    expect(() => validateAcceptance({ files: [{ path: "/etc/x" }] })).toThrow(
      "must be relative"
    );
    expect(() => validateAcceptance({ files: [{ path: "../x" }] })).toThrow(
      "escapes the workspace"
    );
    expect(() => validateAcceptance({ files: [{ path: "a", contains: 42 }] })).toThrow(
      "contains must be a string"
    );
    expect(() => validateAcceptance({ files: [{ path: "a", contains: "" }] })).toThrow(
      "contains cannot be empty"
    );
  });

  it("accepts an optional bounded tests array", () => {
    expect(validateAcceptance({ files: [], tests: [] })).toEqual({
      files: [],
      tests: [],
    });
    expect(
      validateAcceptance({ files: [], tests: [{ command: "  pytest  " }] })
    ).toEqual({ files: [], tests: [{ command: "pytest" }] });
    expect(() =>
      validateAcceptance({ files: [], tests: "pytest" })
    ).toThrow("tests must be an array");
    expect(() =>
      validateAcceptance({ files: [], tests: [{}] })
    ).toThrow("requires a command string");
    expect(() =>
      validateAcceptance({ files: [], tests: [{ command: "   " }] })
    ).toThrow("command cannot be empty");
    expect(() =>
      validateAcceptance({
        files: [],
        tests: [{ command: "x".repeat(MAX_TEST_COMMAND_CHARS + 1) }],
      })
    ).toThrow("command is too long");
    expect(() =>
      validateAcceptance({
        files: [],
        tests: Array.from({ length: MAX_ACCEPTANCE_TESTS + 1 }, () => ({
          command: "true",
        })),
      })
    ).toThrow("at most");
  });
});

describe("verifyAcceptanceTests", () => {
  it("passes when every command succeeds", async () => {
    const seen: string[] = [];
    const result = await verifyAcceptanceTests(
      [{ command: "pytest" }, { command: "node --check app.js" }],
      async (command) => {
        seen.push(command);
        return { ok: true, output: "ok" };
      }
    );

    expect(result).toEqual({ passed: true, failures: [] });
    expect(seen).toEqual(["pytest", "node --check app.js"]);
  });

  it("fails closed on command failure or runner error", async () => {
    const failed = await verifyAcceptanceTests([{ command: "pytest" }], async () => ({
      ok: false,
      output: "1 failed, 2 passed",
    }));
    expect(failed.passed).toBe(false);
    expect(failed.failures.join(";")).toContain("expected test failed: pytest");

    const errored = await verifyAcceptanceTests(
      [{ command: "pytest" }],
      async () => {
        throw new Error("boom");
      }
    );
    expect(errored.passed).toBe(false);
    expect(errored.failures.join(";")).toContain("expected test errored");
  });
});

describe("verifyAcceptance", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function sandbox(): Promise<string> {
    dir = await mkdtemp(join(tmpdir(), "emp-accept-"));
    return dir;
  }

  it("passes when every expectation holds", async () => {
    const root = await sandbox();
    await mkdir(join(root, "sub"), { recursive: true });
    await writeFile(join(root, "hello.txt"), "bonjour", "utf8");
    await writeFile(join(root, "sub", "r.md"), "Report: done.", "utf8");

    const result = await verifyAcceptance(
      root,
      validateAcceptance({
        files: [
          { path: "hello.txt", contains: "bonjour" },
          { path: "sub/r.md" },
        ],
      })
    );

    expect(result).toEqual({ passed: true, failures: [] });
  });

  it("fails closed on missing, mismatched or escaping paths", async () => {
    const root = await sandbox();
    await writeFile(join(root, "hello.txt"), "bonjour", "utf8");

    const missing = await verifyAcceptance(
      root,
      validateAcceptance({ files: [{ path: "nope.txt" }] })
    );
    expect(missing.passed).toBe(false);
    expect(missing.failures.join(";")).toContain("nope.txt");

    const mismatch = await verifyAcceptance(
      root,
      validateAcceptance({ files: [{ path: "hello.txt", contains: "bye" }] })
    );
    expect(mismatch.passed).toBe(false);
    expect(mismatch.failures.join(";")).toContain("required text");

    // Meme construit a la main (hors validate), l'echappement echoue.
    const escape = await verifyAcceptance(root, {
      files: [{ path: "../outside.txt", contains: null }],
    });
    expect(escape.passed).toBe(false);
    expect(escape.failures.join(";")).toContain("escapes the workspace");
  });
});

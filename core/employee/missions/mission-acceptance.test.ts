import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  validateAcceptance,
  verifyAcceptance,
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

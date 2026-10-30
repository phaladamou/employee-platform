import { describe, expect, it } from "vitest";

import {
  canonicalizeJson,
  hashProfileContent,
} from "./profile-integrity";

describe("canonicalizeJson", () => {
  it("sorts keys recursively", () => {
    expect(
      canonicalizeJson({ b: 1, a: { d: [3, 2], c: "x" } })
    ).toBe('{"a":{"c":"x","d":[3,2]},"b":1}');
  });

  it("ignores formatting differences", () => {
    const pretty = JSON.parse('{\n  "b": 1,\n  "a": true\n}');
    const compact = JSON.parse('{"a":true,"b":1}');
    expect(canonicalizeJson(pretty)).toBe(canonicalizeJson(compact));
  });

  it("rejects non-JSON values", () => {
    expect(() => canonicalizeJson(undefined)).toThrow(
      "Only JSON values can be canonicalized"
    );
  });
});

describe("hashProfileContent", () => {
  const spec = {
    name: "data-analyst",
    version: "1.0.0",
    allowedTools: ["read_file"],
  };

  it("is deterministic", () => {
    expect(hashProfileContent(spec)).toBe(hashProfileContent({ ...spec }));
    expect(hashProfileContent(spec)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes on any semantic change", () => {
    const base = hashProfileContent(spec);
    expect(
      hashProfileContent({ ...spec, allowedTools: ["read_file", "run_shell"] })
    ).not.toBe(base);
    expect(hashProfileContent({ ...spec, version: "1.0.1" })).not.toBe(base);
    expect(hashProfileContent({ ...spec, extra: true })).not.toBe(base);
  });
});

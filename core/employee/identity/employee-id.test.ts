import { describe, expect, it } from "vitest";

import {
  generateEmployeeIdentity,
  verifyEmployeeIdentity,
} from "./employee-id";

describe("generateEmployeeIdentity", () => {
  it("creates a prefixed id with a 64-char hex fingerprint", () => {
    const identity = generateEmployeeIdentity(
      new Date("2026-01-01T00:00:00.000Z")
    );

    expect(identity.id.startsWith("emp_")).toBe(true);
    expect(identity.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(identity.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("generates unique ids", () => {
    const ids = new Set<string>();

    for (let i = 0; i < 100; i += 1) {
      ids.add(generateEmployeeIdentity().id);
    }

    expect(ids.size).toBe(100);
  });
});

describe("verifyEmployeeIdentity", () => {
  it("accepts a genuine identity", () => {
    expect(
      verifyEmployeeIdentity(generateEmployeeIdentity())
    ).toBe(true);
  });

  it("rejects a tampered fingerprint", () => {
    const identity = generateEmployeeIdentity();

    expect(
      verifyEmployeeIdentity({ ...identity, fingerprint: "0".repeat(64) })
    ).toBe(false);
  });

  it("rejects a foreign id format", () => {
    const identity = generateEmployeeIdentity();

    expect(
      verifyEmployeeIdentity({ ...identity, id: "user_123" })
    ).toBe(false);
  });
});

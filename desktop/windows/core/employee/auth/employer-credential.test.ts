import { describe, expect, it } from "vitest";

import type { EmployerCredentialStore } from "./employer-credential-store";
import {
  EMPLOYER_TOKEN_PREFIX,
  generateEmployerToken,
  isEmployerCredential,
  issueEmployerCredential,
  verifyEmployerCredential,
  type EmployerCredential,
} from "./employer-credential";
import { hashCredentialToken } from "./employee-credential";

function createFakeStore(): EmployerCredentialStore & {
  records: EmployerCredential[];
} {
  const records: EmployerCredential[] = [];
  return {
    records,
    async save(credential) {
      const index = records.findIndex((c) => c.id === credential.id);
      if (index === -1) {
        records.push(credential);
      } else {
        records[index] = credential;
      }
    },
    async findByHash(tokenHash) {
      return records.find((c) => c.tokenHash === tokenHash) ?? null;
    },
    async revoke(id, now = new Date()) {
      const index = records.findIndex((c) => c.id === id);
      if (index === -1) {
        throw new Error(`Unknown credential: ${id}`);
      }
      records[index] = { ...records[index], revokedAt: now.toISOString() };
    },
    async listByEmployer(employerId) {
      return records.filter((c) => c.employerId === employerId);
    },
  };
}

const NOW = new Date("2026-10-30T12:00:00.000Z");

describe("issueEmployerCredential", () => {
  it("emits a token once and stores only its hash", () => {
    const { credential, token } = issueEmployerCredential({
      employerId: "acme",
      label: "api-prod",
      scopes: ["missions:submit", "missions:read"],
      id: "emcred_test",
      token: "emo_test-token-value",
      now: NOW,
    });

    expect(token).toBe("emo_test-token-value");
    expect(credential.employerId).toBe("acme");
    expect(credential.tokenHash).toBe(hashCredentialToken(token));
    expect(JSON.stringify(credential)).not.toContain(token);
  });

  it("generates unique prefixed random tokens", () => {
    const base = {
      employerId: "acme",
      label: "k",
      scopes: ["missions:read"] as const,
      now: NOW,
    };
    const first = generateEmployerToken();
    const second = issueEmployerCredential({ ...base, scopes: ["missions:read"] });

    expect(first.startsWith(EMPLOYER_TOKEN_PREFIX)).toBe(true);
    expect(first.slice(EMPLOYER_TOKEN_PREFIX.length)).toMatch(
      /^[A-Za-z0-9_-]{43}$/
    );
    expect(second.token).not.toBe(first);
  });

  it("rejects invalid inputs", () => {
    expect(() =>
      issueEmployerCredential({
        employerId: "  ",
        label: "k",
        scopes: ["missions:read"],
      })
    ).toThrow("Employer id cannot be empty");
    expect(() =>
      issueEmployerCredential({
        employerId: "acme",
        label: "k",
        scopes: [],
      })
    ).toThrow("at least one scope");
    expect(() =>
      issueEmployerCredential({
        employerId: "acme",
        label: "k",
        scopes: ["nope" as never],
      })
    ).toThrow("Unknown credential scope: nope");
  });
});

describe("verifyEmployerCredential", () => {
  it("accepts valid tokens with scope", async () => {
    const store = createFakeStore();
    const { credential, token } = issueEmployerCredential({
      employerId: "acme",
      label: "k",
      scopes: ["missions:submit"],
      now: NOW,
    });
    await store.save(credential);

    await expect(
      verifyEmployerCredential(store, token, { scope: "missions:submit", now: NOW })
    ).resolves.toEqual(credential);
    await expect(
      verifyEmployerCredential(store, token, { scope: "admin", now: NOW })
    ).resolves.toBeNull();
  });

  it("rejects unknown, expired and revoked tokens", async () => {
    const store = createFakeStore();
    const { credential, token } = issueEmployerCredential({
      employerId: "acme",
      label: "k",
      scopes: ["missions:read"],
      ttlMs: 60_000,
      now: NOW,
    });
    await store.save(credential);

    await expect(verifyEmployerCredential(store, "emo_nope", { now: NOW }))
      .resolves.toBeNull();
    await expect(
      verifyEmployerCredential(store, token, {
        now: new Date("2026-10-30T12:02:00.000Z"),
      })
    ).resolves.toBeNull();

    await store.revoke(credential.id, NOW);
    await expect(verifyEmployerCredential(store, token, { now: NOW })).resolves
      .toBeNull();
  });
});

describe("isEmployerCredential", () => {
  it("validates stored shapes", () => {
    const { credential } = issueEmployerCredential({
      employerId: "acme",
      label: "k",
      scopes: ["missions:read"],
      now: NOW,
    });
    expect(isEmployerCredential(credential)).toBe(true);
    expect(isEmployerCredential({ ...credential, employerId: 42 })).toBe(false);
    expect(isEmployerCredential(null)).toBe(false);
  });
});

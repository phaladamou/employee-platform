import { describe, expect, it } from "vitest";

import type { EmployeeCredentialStore } from "./credential-store";
import {
  CREDENTIAL_TOKEN_PREFIX,
  hashCredentialToken,
  isEmployeeCredential,
  issueCredential,
  verifyCredential,
  type EmployeeCredential,
} from "./employee-credential";

// Faux stockage en memoire (le contrat du port, sans disque).
function createFakeStore(): EmployeeCredentialStore & {
  records: EmployeeCredential[];
} {
  const records: EmployeeCredential[] = [];
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
    async list(employeeId) {
      return records.filter((c) => c.employeeId === employeeId);
    },
  };
}

const NOW = new Date("2026-10-30T12:00:00.000Z");

function issueForTests(
  overrides: Partial<Parameters<typeof issueCredential>[0]> = {}
) {
  return issueCredential({
    employeeId: "emp_ada",
    label: "cli-local",
    scopes: ["missions:submit", "missions:read"],
    id: "cred_test",
    token: "emk_test-token-value",
    now: NOW,
    ...overrides,
  });
}

describe("issueCredential", () => {
  it("emits a token once and stores only its hash", () => {
    const { credential, token } = issueForTests();

    expect(token).toBe("emk_test-token-value");
    expect(credential.tokenHash).toBe(hashCredentialToken(token));
    expect(credential.tokenHash).not.toBe(token);
    // Le clair n'apparait nulle part dans l'objet stockable.
    expect(JSON.stringify(credential)).not.toContain(token);
    expect(credential.revokedAt).toBeNull();
    expect(credential.createdAt).toBe("2026-10-30T12:00:00.000Z");
  });

  it("generates prefixed random tokens by default", () => {
    const first = issueCredential({
      employeeId: "emp_ada",
      label: "a",
      scopes: ["memory:read"],
      id: "cred_1",
      now: NOW,
    });
    const second = issueCredential({
      employeeId: "emp_ada",
      label: "b",
      scopes: ["memory:read"],
      id: "cred_2",
      now: NOW,
    });

    for (const issued of [first, second]) {
      expect(issued.token.startsWith(CREDENTIAL_TOKEN_PREFIX)).toBe(true);
      // Prefixe distinct des IDs employe (`emp_...`).
      expect(issued.token.startsWith("emp_")).toBe(false);
    }
    expect(first.token).not.toBe(second.token);
  });

  it("tokens carry 32 bytes of cryptographic entropy", () => {
    const { token } = issueCredential({
      employeeId: "emp_ada",
      label: "a",
      scopes: ["memory:read"],
      now: NOW,
    });
    const body = token.slice(CREDENTIAL_TOKEN_PREFIX.length);
    // 32 octets => 43 caracteres base64url, sans padding.
    expect(body).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("computes expiresAt from ttlMs", () => {
    const { credential } = issueForTests({ ttlMs: 3_600_000 });
    expect(credential.expiresAt).toBe("2026-10-30T13:00:00.000Z");
  });

  it("explicit expiresAt wins over ttlMs", () => {
    const { credential } = issueForTests({
      ttlMs: 3_600_000,
      expiresAt: "2027-01-01T00:00:00.000Z",
    });
    expect(credential.expiresAt).toBe("2027-01-01T00:00:00.000Z");
  });

  it("rejects invalid inputs", () => {
    expect(() =>
      issueForTests({ employeeId: "  " })
    ).toThrow("Employee id cannot be empty");
    expect(() => issueForTests({ label: "" })).toThrow(
      "Credential label cannot be empty"
    );
    expect(() => issueForTests({ scopes: [] })).toThrow(
      "at least one scope"
    );
    expect(() =>
      issueForTests({ scopes: ["nope" as never] })
    ).toThrow("Unknown credential scope: nope");
    expect(() => issueForTests({ ttlMs: 0 })).toThrow("positive number");
    expect(() => issueForTests({ expiresAt: "not-a-date" })).toThrow(
      "not a valid date"
    );
  });
});

describe("verifyCredential", () => {
  it("accepts a valid token and returns its credential", async () => {
    const store = createFakeStore();
    const { credential, token } = issueForTests();
    await store.save(credential);

    await expect(
      verifyCredential(store, token, { scope: "missions:submit", now: NOW })
    ).resolves.toEqual(credential);
  });

  it("rejects unknown, empty, expired, revoked and out-of-scope tokens", async () => {
    const store = createFakeStore();
    const { credential, token } = issueForTests({ ttlMs: 60_000 });
    await store.save(credential);

    await expect(verifyCredential(store, "emk_nope", { now: NOW })).resolves
      .toBeNull();
    await expect(verifyCredential(store, "", { now: NOW })).resolves.toBeNull();
    await expect(
      verifyCredential(store, token, {
        now: new Date("2026-10-30T12:02:00.000Z"),
      })
    ).resolves.toBeNull();
    await expect(
      verifyCredential(store, token, { scope: "admin", now: NOW })
    ).resolves.toBeNull();

    await store.revoke(credential.id, NOW);
    await expect(verifyCredential(store, token, { now: NOW })).resolves
      .toBeNull();
  });

  it("revocation kills the key without destroying the identity", async () => {
    const store = createFakeStore();
    const { credential, token } = issueForTests();
    await store.save(credential);

    await store.revoke(credential.id, NOW);

    const [listed] = await store.list("emp_ada");
    // La fiche survit (audit), l'identite est intacte, le token est mort.
    expect(listed.employeeId).toBe("emp_ada");
    expect(listed.revokedAt).toBe("2026-10-30T12:00:00.000Z");
    await expect(verifyCredential(store, token, { now: NOW })).resolves
      .toBeNull();
  });
});

describe("isEmployeeCredential", () => {
  it("validates stored shapes", () => {
    const { credential } = issueForTests();
    expect(isEmployeeCredential(credential)).toBe(true);
    expect(isEmployeeCredential({ ...credential, scopes: ["nope"] })).toBe(
      false
    );
    expect(isEmployeeCredential(null)).toBe(false);
    expect(isEmployeeCredential("emk_test-token-value")).toBe(false);
  });
});

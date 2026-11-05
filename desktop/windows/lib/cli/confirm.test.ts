// lib/cli/confirm.test.ts
// Execution : node --test lib/cli/confirm.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createConfirmToken, verifyConfirmToken } from "./confirm.ts";

const SECRET = "test-secret-please-ignore";
const ACCOUNT = "account-1";

describe("confirm tokens", () => {
  it("round-trips a payload", () => {
    const token = createConfirmToken(SECRET, ACCOUNT, {
      action: "hire",
      params: { spec: "atlas@1.0.0" },
    });
    assert.deepEqual(verifyConfirmToken(SECRET, token, ACCOUNT), {
      action: "hire",
      params: { spec: "atlas@1.0.0" },
    });
  });

  it("rejects tampered bodies", () => {
    const token = createConfirmToken(SECRET, ACCOUNT, {
      action: "cancel",
      params: { missionId: "abc" },
    });
    const [body, sig] = token.split(".");
    const forged =
      Buffer.from(
        JSON.stringify({
          action: "cancel",
          params: { missionId: "other" },
          accountId: ACCOUNT,
          expiresAt: Date.now() + 60_000,
        })
      ).toString("base64url") + `.${sig}`;
    assert.equal(verifyConfirmToken(SECRET, forged, ACCOUNT), null);
    assert.equal(verifyConfirmToken(SECRET, `${body}.deadbeef`, ACCOUNT), null);
  });

  it("rejects cross-account replay", () => {
    const token = createConfirmToken(SECRET, ACCOUNT, {
      action: "submit",
      params: { title: "t" },
    });
    assert.equal(verifyConfirmToken(SECRET, token, "account-2"), null);
  });

  it("rejects expired tokens", () => {
    const token = createConfirmToken(
      SECRET,
      ACCOUNT,
      { action: "hire", params: { spec: "x" } },
      1_000,
      60_000
    );
    assert.equal(verifyConfirmToken(SECRET, token, ACCOUNT, 61_001), null);
  });

  it("rejects malformed tokens and empty secrets", () => {
    assert.equal(verifyConfirmToken(SECRET, "nope", ACCOUNT), null);
    assert.equal(verifyConfirmToken(SECRET, "", ACCOUNT), null);
    assert.equal(verifyConfirmToken("", "a.b", ACCOUNT), null);
    assert.throws(() =>
      createConfirmToken("", ACCOUNT, { action: "hire", params: {} })
    );
  });
});

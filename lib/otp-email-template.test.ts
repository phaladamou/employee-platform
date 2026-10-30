// lib/otp-email-template.test.ts
// Contrat du gabarit d'email OTP.
// Execution : node --test lib/otp-email-template.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildOtpEmailHtml,
  buildOtpEmailText,
  otpEmailSubject,
} from "./otp-email-template.ts";

describe("otp email template", () => {
  it("builds a subject containing the code", () => {
    assert.ok(otpEmailSubject("1234567").includes("1234567"));
  });

  it("builds branded HTML containing code and expiry", () => {
    const html = buildOtpEmailHtml("1234567", 5);

    assert.ok(html.includes("1234567"));
    assert.ok(html.includes("Employee"));
    assert.ok(html.includes("cid:employee-logo"));
    assert.ok(html.includes("5 minutes"));
    assert.ok(html.includes("letter-spacing"));
    assert.ok(!html.includes("undefined"));
  });

  it("builds a text fallback containing code and expiry", () => {
    const text = buildOtpEmailText("1234567", 5);

    assert.ok(text.includes("1234567"));
    assert.ok(text.includes("5 minutes"));
    assert.ok(!text.includes("undefined"));
  });
});

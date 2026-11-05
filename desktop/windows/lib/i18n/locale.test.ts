// lib/i18n/locale.test.ts
// Non-regression : le changement de langue passe par cookie,
// jamais par prefixe d'URL (/fr/... = 404).
// Execution : node --test lib/i18n/locale.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildLocaleCookie,
  isSupportedLocale,
  SUPPORTED_LOCALES,
} from "./locale.ts";

describe("locale cookie", () => {
  it("exposes exactly en/fr/zh", () => {
    assert.deepEqual([...SUPPORTED_LOCALES], ["en", "fr", "zh"]);
  });

  it("builds the NEXT_LOCALE cookie for fr", () => {
    assert.equal(buildLocaleCookie("fr"), "NEXT_LOCALE=fr;path=/;max-age=31536000");
  });

  it("builds the NEXT_LOCALE cookie for en and zh", () => {
    assert.equal(buildLocaleCookie("en"), "NEXT_LOCALE=en;path=/;max-age=31536000");
    assert.equal(buildLocaleCookie("zh"), "NEXT_LOCALE=zh;path=/;max-age=31536000");
  });

  it("rejects unsupported locales", () => {
    assert.throws(() => buildLocaleCookie("de"), /Unsupported locale/);
    assert.equal(isSupportedLocale("de"), false);
    assert.equal(isSupportedLocale("fr"), true);
  });
});

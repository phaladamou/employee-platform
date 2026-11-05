// app/api/onboarding/route.test.ts
// Non-regression : la route POST /api/onboarding doit rester hors du
// groupe (chat), sinon le layout (chat) redirige l'appel lui-meme vers
// /onboarding (utilisateur non-onboarde) et la validation echoue.
// Execution : node --test app/api/onboarding/route.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..", "..");

describe("onboarding route placement", () => {
  it("existe a la racine app/api (meme URL /api/onboarding)", () => {
    assert.equal(
      existsSync(join(ROOT, "app", "api", "onboarding", "route.ts")),
      true
    );
  });

  it("n'est PAS sous app/(chat)/api (layout avec redirect)", () => {
    assert.equal(
      existsSync(join(ROOT, "app", "(chat)", "api", "onboarding", "route.ts")),
      false
    );
  });
});

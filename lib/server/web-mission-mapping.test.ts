// lib/server/web-mission-mapping.test.ts
// Execution : node --test lib/server/web-mission-mapping.test.ts
// (fonctions pures uniquement : jamais d'appel LLM ici).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  resolveSpecialization,
  toWebStatus,
} from "./web-mission-mapping.ts";

describe("toWebStatus", () => {
  it("maps kernel statuses to web statuses", () => {
    assert.equal(toWebStatus("completed"), "succeeded");
    assert.equal(toWebStatus("failed"), "failed");
    assert.equal(toWebStatus("needs_review"), "needs_review");
    assert.equal(toWebStatus("running"), "running");
    assert.equal(toWebStatus("pending"), "queued");
  });
});

describe("resolveSpecialization", () => {
  it("binds talent spec and version", () => {
    assert.deepEqual(
      resolveSpecialization({
        talentSpec: "atlas-software-engineer",
        specVersion: "1.0.0",
      }),
      { name: "atlas-software-engineer", version: "1.0.0" }
    );
  });

  it("returns null without a bound spec (Chef, legacy)", () => {
    assert.equal(
      resolveSpecialization({ talentSpec: null, specVersion: null }),
      null
    );
    assert.equal(
      resolveSpecialization({ talentSpec: "x", specVersion: null }),
      null
    );
    assert.equal(
      resolveSpecialization({ talentSpec: null, specVersion: "1.0.0" }),
      null
    );
  });
});

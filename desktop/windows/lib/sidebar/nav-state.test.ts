// desktop/windows/lib/sidebar/nav-state.test.ts
// Contrat d'etat actif des sections employes.
// Execution : node --test desktop/windows/lib/sidebar/nav-state.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isEmployeesSection, isRecruitSection } from "./nav-state.ts";

describe("sidebar nav state", () => {
  it("marks employees active on the employees page", () => {
    assert.equal(isEmployeesSection("/employees"), true);
    assert.equal(isRecruitSection("/employees"), false);
  });

  it("marks only recruit active on the talent network page", () => {
    assert.equal(isRecruitSection("/employees/recruit"), true);
    assert.equal(isEmployeesSection("/employees/recruit"), false);
  });

  it("marks neither active outside the employees area", () => {
    for (const pathname of ["/workspace", "/computer", "/cli", "/login"]) {
      assert.equal(isEmployeesSection(pathname), false);
      assert.equal(isRecruitSection(pathname), false);
    }
  });
});

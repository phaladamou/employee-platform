// lib/employees/departments.test.ts
// Execution : node --test lib/employees/departments.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { KNOWN_DEPARTMENTS, visibleDepartments } from "./departments.ts";

describe("visibleDepartments", () => {
  it("shows the 3 known departments in fixed order", () => {
    assert.deepEqual(KNOWN_DEPARTMENTS, [
      "engineering",
      "research-data",
      "operations",
    ]);
    assert.deepEqual(visibleDepartments([]), [
      "engineering",
      "research-data",
      "operations",
    ]);
  });

  it("appends unknown departments alphabetically without duplicates", () => {
    assert.deepEqual(
      visibleDepartments(["zeta", "engineering", "alpha", "zeta"]),
      ["engineering", "research-data", "operations", "alpha", "zeta"]
    );
  });
});

// lib/employees/department-url.test.ts
// Execution : node --test lib/employees/department-url.test.ts
// (fonctions pures uniquement : jamais de router ici).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildDepartmentUrl,
  EMPLOYEE_PARAM,
  parseEmployeeParam,
} from "./department-url.ts";

describe("buildDepartmentUrl", () => {
  it("builds the list url without an employee", () => {
    assert.equal(buildDepartmentUrl("engineering", null), "/departments/engineering");
    assert.equal(buildDepartmentUrl("engineering", ""), "/departments/engineering");
  });

  it("builds the employee url with the query param", () => {
    assert.equal(
      buildDepartmentUrl("engineering", "atlas-id"),
      `/departments/engineering?${EMPLOYEE_PARAM}=atlas-id`
    );
  });

  it("encodes department and employee segments", () => {
    assert.equal(
      buildDepartmentUrl("r&d", "a/b?c"),
      "/departments/r%26d?employee=a%2Fb%3Fc"
    );
  });
});

describe("parseEmployeeParam", () => {
  it("returns the trimmed id", () => {
    assert.equal(parseEmployeeParam("atlas-id"), "atlas-id");
    assert.equal(parseEmployeeParam("  atlas-id  "), "atlas-id");
  });

  it("returns null when absent or blank", () => {
    assert.equal(parseEmployeeParam(null), null);
    assert.equal(parseEmployeeParam(undefined), null);
    assert.equal(parseEmployeeParam(""), null);
    assert.equal(parseEmployeeParam("   "), null);
  });
});

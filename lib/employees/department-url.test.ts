// lib/employees/department-url.test.ts
// Execution : node --test lib/employees/department-url.test.ts
// (fonctions pures uniquement : jamais de router ici).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildEmployeeUrl,
  EMPLOYEE_PARAM,
  parseEmployeeParam,
  resolveEmployeeSlug,
  slugifyEmployeeName,
} from "./department-url.ts";

describe("slugifyEmployeeName", () => {
  it("lowercases and trims names", () => {
    assert.equal(slugifyEmployeeName("Atlas"), "atlas");
    assert.equal(slugifyEmployeeName("  Nova  "), "nova");
  });

  it("strips accents and unsafe chars", () => {
    assert.equal(slugifyEmployeeName("André R&D"), "andre-r-d");
    assert.equal(slugifyEmployeeName("a/b?c"), "a-b-c");
  });

  it("falls back for empty names", () => {
    assert.equal(slugifyEmployeeName(""), "employee");
    assert.equal(slugifyEmployeeName("---"), "employee");
  });
});

describe("resolveEmployeeSlug", () => {
  const members = [
    { id: "id-atlas", name: "Atlas" },
    { id: "id-pm", name: "Project Manager" },
  ];

  it("matches slugs case-insensitively", () => {
    assert.equal(resolveEmployeeSlug(members, "atlas")?.id, "id-atlas");
    assert.equal(
      resolveEmployeeSlug(members, "project-manager")?.id,
      "id-pm"
    );
  });

  it("accepts raw ids for compatibility", () => {
    assert.equal(resolveEmployeeSlug(members, "id-atlas")?.id, "id-atlas");
  });

  it("returns null for unknown slugs", () => {
    assert.equal(resolveEmployeeSlug(members, "nope"), null);
    assert.equal(resolveEmployeeSlug(members, ""), null);
  });
});

describe("buildEmployeeUrl", () => {
  it("builds the workspace url without a session", () => {
    assert.equal(
      buildEmployeeUrl("engineering", "atlas", null),
      "/departments/engineering/atlas"
    );
  });

  it("builds the session url with a session id", () => {
    assert.equal(
      buildEmployeeUrl("engineering", "atlas", "s1"),
      "/departments/engineering/atlas/s1"
    );
  });

  it("encodes segments", () => {
    assert.equal(
      buildEmployeeUrl("r&d", "a/b", "s 1"),
      "/departments/r%26d/a%2Fb/s%201"
    );
  });
});

describe("legacy employee param", () => {
  it("keeps the compat parser", () => {
    assert.equal(EMPLOYEE_PARAM, "employee");
    assert.equal(parseEmployeeParam("abc"), "abc");
    assert.equal(parseEmployeeParam(null), null);
    assert.equal(parseEmployeeParam("   "), null);
  });
});

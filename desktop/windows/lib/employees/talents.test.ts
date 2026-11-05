// lib/employees/talents.test.ts
// Contrat du pont noyau -> catalogue web (lecture seule).
// Execution : node --test lib/employees/talents.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  TALENT_CATALOG,
  displayNameForSpec,
  isCatalogSpec,
  loadCatalogSpecs,
  parseKernelSpec,
  toTalentSeed,
} from "./talents.ts";

const PROFILES_DIR = join(
  import.meta.dirname,
  "..",
  "..",
  "core",
  "employee",
  "profiles"
);

const EXPECTED_NAMES = ["Atlas", "Nova", "Aria", "Newton", "Milo", "Sana"];

describe("kernel talent bridge", () => {
  it("references exactly the 6 catalog specs", () => {
    assert.deepEqual(Object.keys(TALENT_CATALOG).sort(), [
      "aria-data-analyst",
      "atlas-software-engineer",
      "milo-content-strategist",
      "newton-researcher",
      "nova-devops-engineer",
      "sana-seo-analyst",
    ]);
  });

  it("loads the 6 specs from the kernel profiles dir", () => {
    const specs = loadCatalogSpecs(PROFILES_DIR);
    assert.equal(specs.length, 6);
    assert.deepEqual(
      specs.map((s) => s.name).sort(),
      Object.keys(TALENT_CATALOG).sort()
    );
  });

  it("ignores generic specs outside the catalog", () => {
    const specs = loadCatalogSpecs(PROFILES_DIR);
    const names = specs.map((s) => s.name);
    for (const generic of ["data-analyst", "researcher", "software-engineer"]) {
      assert.ok(!names.includes(generic), generic);
    }
  });

  it("derives display names from spec names", () => {
    assert.deepEqual(
      Object.keys(TALENT_CATALOG)
        .sort()
        .map(displayNameForSpec)
        .sort(),
      [...EXPECTED_NAMES].sort()
    );
    assert.equal(displayNameForSpec("atlas-software-engineer"), "Atlas");
  });

  it("maps every talent to a known department with techs and tools", () => {
    const departments = new Set(["engineering", "research-data", "operations"]);
    for (const spec of loadCatalogSpecs(PROFILES_DIR)) {
      const seed = toTalentSeed(spec);
      assert.ok(departments.has(seed.departmentId), seed.spec);
      assert.ok(seed.background.length > 0, seed.spec);
      assert.ok(seed.allowedTools.length > 0, seed.spec);
      assert.ok(seed.technologies.length >= 2, seed.spec);
      assert.equal(seed.createdBy, "Cofoundator");
    }
  });

  it("rejects specs outside the catalog", () => {
    assert.equal(isCatalogSpec("data-analyst"), false);
    assert.throws(() =>
      toTalentSeed({
        name: "data-analyst",
        version: "1.0.0",
        role: "Data Analyst",
        systemPrompt: "x",
        allowedTools: ["read_file"],
      })
    );
  });

  it("parses strictly and fails loudly on invalid specs", () => {
    assert.throws(() => parseKernelSpec(null));
    assert.throws(() => parseKernelSpec({ name: "x" }));
    assert.throws(() =>
      parseKernelSpec({
        name: "x",
        version: "1.0.0",
        role: "R",
        systemPrompt: "S",
        allowedTools: [],
      })
    );
    const ok = parseKernelSpec({
      name: "atlas-software-engineer",
      version: "1.0.0",
      role: "Software Engineer",
      systemPrompt: "Build.",
      allowedTools: ["read_file"],
      extra: "ignored",
    });
    assert.equal(ok.role, "Software Engineer");
  });
});

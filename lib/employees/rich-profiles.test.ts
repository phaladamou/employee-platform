// lib/employees/rich-profiles.test.ts
// Contrat des fiches riches du Talent Network.
// Execution : node --test lib/employees/rich-profiles.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { RICH_PROFILES, getRichProfile } from "./rich-profiles.ts";
import { isCatalogSpec, loadCatalogSpecs } from "./talents.ts";

const PROFILES_DIR = join(
  import.meta.dirname,
  "..",
  "..",
  "core",
  "employee",
  "profiles"
);

describe("rich talent profiles", () => {
  it("returns null for talents without a rich profile", () => {
    assert.equal(getRichProfile("nova-devops-engineer"), null);
    assert.equal(getRichProfile("aria-data-analyst"), null);
    assert.equal(getRichProfile("unknown-spec"), null);
  });

  it("only references specs from the web catalog", () => {
    for (const spec of Object.keys(RICH_PROFILES)) {
      assert.equal(isCatalogSpec(spec), true);
    }
  });

  it("only claims tools the kernel actually implements", () => {
    const kernelTools = new Map(
      loadCatalogSpecs(PROFILES_DIR).map((spec) => [spec.name, spec.allowedTools])
    );
    for (const [spec, profile] of Object.entries(RICH_PROFILES)) {
      const allowed = kernelTools.get(spec) ?? [];
      for (const tool of profile.tools) {
        assert.ok(
          allowed.includes(tool.name),
          `${spec} claims unimplemented tool: ${tool.name}`
        );
      }
      assert.ok(profile.tools.length > 0, `${spec} has no tools`);
      assert.ok(profile.overview.trim(), `${spec} has no overview`);
      assert.ok(profile.responsibilities.length > 0, spec);
      assert.ok(profile.capabilities.length > 0, spec);
      assert.ok(profile.boundaries.length > 0, spec);
      assert.ok(profile.deliverables.length > 0, spec);
      assert.ok(profile.verification.trim(), spec);
    }
  });
});

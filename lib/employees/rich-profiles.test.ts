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
    assert.equal(getRichProfile("sana-seo-analyst"), null);
    assert.equal(getRichProfile("unknown-spec"), null);
  });

  it("exposes the Milo profile with exactly the kernel tools", () => {
    const milo = getRichProfile("milo-content-strategist");
    assert.ok(milo);
    assert.deepEqual(
      milo.tools.map((tool) => tool.name).sort(),
      ["read_file", "write_file"]
    );
    assert.equal(milo.responsibilities.length, 4);
    assert.equal(milo.capabilities.length, 7);
    assert.equal(milo.boundaries.length, 4);
    assert.equal(milo.deliverables.length, 6);
  });

  it("exposes the Newton profile with exactly the kernel tools", () => {
    const newton = getRichProfile("newton-researcher");
    assert.ok(newton);
    assert.deepEqual(
      newton.tools.map((tool) => tool.name).sort(),
      ["read_file", "write_file"]
    );
    assert.equal(newton.responsibilities.length, 5);
    assert.equal(newton.capabilities.length, 7);
    assert.equal(newton.boundaries.length, 3);
    assert.equal(newton.deliverables.length, 6);
  });

  it("exposes the Aria profile with exactly the kernel tools", () => {
    const aria = getRichProfile("aria-data-analyst");
    assert.ok(aria);
    assert.deepEqual(
      aria.tools.map((tool) => tool.name).sort(),
      ["read_file", "write_file"]
    );
    assert.equal(aria.responsibilities.length, 5);
    assert.equal(aria.capabilities.length, 7);
    assert.equal(aria.boundaries.length, 4);
    assert.equal(aria.deliverables.length, 6);
  });

  it("exposes the Nova profile without write_file (not in kernel)", () => {
    const nova = getRichProfile("nova-devops-engineer");
    assert.ok(nova);
    assert.deepEqual(
      nova.tools.map((tool) => tool.name).sort(),
      ["read_file", "run_shell"]
    );
    assert.ok(
      !nova.tools.some((tool) => tool.name === "write_file"),
      "Nova must not claim write_file"
    );
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

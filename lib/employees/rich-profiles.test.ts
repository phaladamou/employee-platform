// lib/employees/rich-profiles.test.ts
// Contrat des fiches riches du Talent Network.
// Execution : node --test lib/employees/rich-profiles.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  RICH_PROFILES,
  getRichProfile,
  validateRichProfileInput,
} from "./rich-profiles.ts";
import {
  TALENT_CATALOG,
  isCatalogSpec,
  loadCatalogSpecs,
} from "./talents.ts";

const PROFILES_DIR = join(
  import.meta.dirname,
  "..",
  "..",
  "core",
  "employee",
  "profiles"
);

describe("rich talent profiles", () => {
  it("returns null for unknown specs (catalog is fully enriched)", () => {
    for (const spec of Object.keys(TALENT_CATALOG)) {
      assert.ok(getRichProfile(spec), `${spec} should be enriched`);
    }
    assert.equal(getRichProfile("unknown-spec"), null);
  });

  it("exposes the Sana profile with exactly the kernel tools", () => {
    const sana = getRichProfile("sana-seo-analyst");
    assert.ok(sana);
    assert.deepEqual(
      sana.tools.map((tool) => tool.name).sort(),
      ["read_file", "write_file"]
    );
    assert.equal(sana.responsibilities.length, 5);
    assert.equal(sana.capabilities.length, 6);
    assert.equal(sana.boundaries.length, 5);
    assert.equal(sana.deliverables.length, 5);
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

  it("validates partial writes (one word = one field)", () => {
    assert.deepEqual(
      validateRichProfileInput(["read_file"], { overview: "New intro." }),
      { overview: "New intro." }
    );
    assert.deepEqual(
      validateRichProfileInput(["read_file", "write_file"], {
        boundaries: ["Stay in scope."],
        executionEnvironment: ["A lab.", "A shell."],
      }),
      {
        boundaries: ["Stay in scope."],
        executionEnvironment: ["A lab.", "A shell."],
      }
    );
  });

  it("rejects writes the kernel cannot honor", () => {
    // Outil non implemente.
    assert.throws(() =>
      validateRichProfileInput(["run_shell", "read_file"], {
        tools: [{ name: "write_file", description: "Write things." }],
      })
    );
    // Outil sans description.
    assert.throws(() =>
      validateRichProfileInput(["read_file"], {
        tools: [{ name: "read_file", description: "  " }],
      })
    );
    // Champ inconnu (typo) : echec bruyant, jamais silencieux.
    assert.throws(() =>
      validateRichProfileInput(["read_file"], { overveiw: "Typo." })
    );
    // Contenu vide.
    assert.throws(() =>
      validateRichProfileInput(["read_file"], { overview: "   " })
    );
    assert.throws(() =>
      validateRichProfileInput(["read_file"], { capabilities: [] })
    );
    // Corps invalide.
    assert.throws(() => validateRichProfileInput(["read_file"], null));
    assert.throws(() => validateRichProfileInput(["read_file"], ["x"]));
  });

  it("seeds a consumption profile for all 6 talents", () => {
    const expected: Record<string, unknown> = {
      "atlas-software-engineer": {
        estimatedTokensPerMission: 5000,
        estimatedCpuSecondsPerMission: 30,
        minMemoryMb: 512,
        minDiskMb: 100,
        networkRequired: false,
      },
      "nova-devops-engineer": {
        estimatedTokensPerMission: 3000,
        estimatedCpuSecondsPerMission: 60,
        minMemoryMb: 1024,
        minDiskMb: 500,
        networkRequired: true,
      },
      "aria-data-analyst": {
        estimatedTokensPerMission: 2000,
        estimatedCpuSecondsPerMission: 20,
        minMemoryMb: 512,
        minDiskMb: 200,
        networkRequired: false,
      },
      "newton-researcher": {
        estimatedTokensPerMission: 3000,
        estimatedCpuSecondsPerMission: 15,
        minMemoryMb: 256,
        minDiskMb: 50,
        networkRequired: false,
      },
      "milo-content-strategist": {
        estimatedTokensPerMission: 1500,
        estimatedCpuSecondsPerMission: 10,
        minMemoryMb: 256,
        minDiskMb: 50,
        networkRequired: false,
      },
      "sana-seo-analyst": {
        estimatedTokensPerMission: 1500,
        estimatedCpuSecondsPerMission: 10,
        minMemoryMb: 256,
        minDiskMb: 50,
        networkRequired: false,
      },
    };
    assert.deepEqual(Object.keys(RICH_PROFILES).sort(), Object.keys(expected).sort());
    for (const [spec, profile] of Object.entries(RICH_PROFILES)) {
      assert.deepEqual(profile.consumptionProfile, expected[spec]);
      // La graine passe sa propre validation (migrate bruyant sinon).
      assert.deepEqual(
        validateRichProfileInput(["read_file"], {
          consumptionProfile: profile.consumptionProfile,
        }),
        { consumptionProfile: expected[spec] }
      );
    }
  });

  it("rejects malformed consumption profiles", () => {
    const good = {
      estimatedTokensPerMission: 100,
      estimatedCpuSecondsPerMission: 5,
      minMemoryMb: 256,
      minDiskMb: 50,
      networkRequired: false,
    };
    assert.deepEqual(
      validateRichProfileInput(["read_file"], { consumptionProfile: good }),
      { consumptionProfile: good }
    );
    // Non-objet.
    assert.throws(() =>
      validateRichProfileInput(["read_file"], { consumptionProfile: null })
    );
    assert.throws(() =>
      validateRichProfileInput(["read_file"], { consumptionProfile: "cheap" })
    );
    // Nombres negatifs, absents ou non finis.
    assert.throws(() =>
      validateRichProfileInput(["read_file"], {
        consumptionProfile: { ...good, estimatedTokensPerMission: -1 },
      })
    );
    assert.throws(() =>
      validateRichProfileInput(["read_file"], {
        consumptionProfile: { ...good, minDiskMb: Number.NaN },
      })
    );
    const { minMemoryMb: _dropped, ...missing } = good;
    assert.throws(() =>
      validateRichProfileInput(["read_file"], { consumptionProfile: missing })
    );
    // Reseau non booleen.
    assert.throws(() =>
      validateRichProfileInput(["read_file"], {
        consumptionProfile: { ...good, networkRequired: "yes" },
      })
    );
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

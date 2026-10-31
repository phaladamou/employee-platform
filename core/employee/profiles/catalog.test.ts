import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { FileEmploymentStore } from "../employments/file-employment-store";
import { verifyEmployeeIdentity } from "../identity/employee-id";
import { FileJobStore } from "../jobs/file-job-store";
import { FileMissionStore } from "../missions/file-mission-store";
import { FileProfileStore } from "../profile/file-profile-store";
import { resolveToolsForProfile } from "../runtime/profile-tools";
import { InProcessEmployeeClient } from "../sdk/in-process-client";
import { InProcessEmployeeCreator } from "../sdk/in-process-creator";
import { createCoreTools } from "../tools/tool";
import { loadProfileRegistry } from "./profile-registry";

const HERE = fileURLToPath(new URL(".", import.meta.url));

/**
 * Catalogue initial : 6 employs Cofoundator en 3 departements
 * (Engineering, Research & Data, Operations). Le metier vit dans
 * les JSON (config), jamais dans le noyau.
 */
const CATALOG = [
  {
    employee: "Atlas",
    spec: "atlas-software-engineer",
    role: "Software Engineer",
    tools: ["read_file", "write_file", "run_shell"],
  },
  {
    employee: "Nova",
    spec: "nova-devops-engineer",
    role: "DevOps Engineer",
    tools: ["run_shell", "read_file"],
  },
  {
    employee: "Aria",
    spec: "aria-data-analyst",
    role: "Data Analyst",
    tools: ["read_file", "write_file"],
  },
  {
    employee: "Newton",
    spec: "newton-researcher",
    role: "Researcher",
    tools: ["read_file", "write_file"],
  },
  {
    employee: "Milo",
    spec: "milo-content-strategist",
    role: "Content Strategist",
    tools: ["read_file", "write_file"],
  },
  {
    employee: "Sana",
    spec: "sana-seo-analyst",
    role: "SEO Analyst",
    tools: ["read_file", "write_file"],
  },
] as const;

describe("initial AI employee catalog", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  it("ships the 6 Cofoundator specs, lockfile-verified", async () => {
    const registry = await loadProfileRegistry(HERE);

    for (const entry of CATALOG) {
      const spec = registry.get(entry.spec, "1.0.0");
      expect(spec?.role).toBe(entry.role);
      expect(spec?.allowedTools).toEqual(entry.tools);
      expect(spec?.systemPrompt?.startsWith("Forged by Cofoundator.")).toBe(
        true
      );
      // Coherence outils/permissions : chaque spec doit resoudre.
      expect(() =>
        resolveToolsForProfile(spec!, createCoreTools())
      ).not.toThrow();
    }
    // Atlas declare sa chaine Python : refusable si absente.
    expect(
      registry.get("atlas-software-engineer", "1.0.0")?.environment
    ).toEqual(["python3", "pip", "pytest", "git"]);
  });

  it("publishes 6 uniquely-identified, hirable employees", async () => {
    const registry = await loadProfileRegistry(HERE);
    dir = await mkdtemp(join(tmpdir(), "emp-catalog-"));
    const profiles = new FileProfileStore({ directory: join(dir, "profiles") });
    const creator = new InProcessEmployeeCreator({ profiles, registry });
    const client = new InProcessEmployeeClient({
      employerId: "acme",
      profiles,
      employments: new FileEmploymentStore({
        directory: join(dir, "employments"),
      }),
      missions: new FileMissionStore({ directory: join(dir, "missions") }),
      jobs: new FileJobStore({ directory: join(dir, "jobs") }),
    });

    const published = [];
    for (const entry of CATALOG) {
      published.push(
        await creator.publishEmployee({
          name: entry.employee,
          role: entry.role,
          specialization: { name: entry.spec, version: "1.0.0" },
          createdBy: "Cofoundator",
        })
      );
    }

    // Identites cryptographiques uniques et valides.
    expect(new Set(published.map((p) => p.id)).size).toBe(6);
    expect(
      new Set(published.map((p) => p.identity.fingerprint)).size
    ).toBe(6);
    for (const profile of published) {
      expect(verifyEmployeeIdentity(profile.identity)).toBe(true);
      expect(profile.createdBy).toBe("Cofoundator");
    }

    // Enregistres au catalogue et recrutables.
    expect(await creator.listEmployees()).toHaveLength(6);
    for (const profile of published) {
      const hire = await client.hire(profile.id);
      expect(hire.employeeId).toBe(profile.id);
      expect(hire.employerId).toBe("acme");
      expect(hire.terminatedAt).toBeNull();
    }
    expect(await client.listHires()).toHaveLength(6);
  });
});

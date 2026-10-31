// lib/db/talent-sync.test.ts
//
// Non-regression : talent-sync.ts tourne sous tsx pur (migrate.ts),
// donc il ne doit jamais importer (meme transitivement) `server-only`
// — qui leve hors Next.js. Ce test tourne en conditions Node
// standard : toute chaine `server-only` reintroduite le fait echouer
// des l'import. Il verifie aussi la logique de synchro sur DB stub.
// Execution : pnpm exec vitest run lib/db/talent-sync.test.ts
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { TALENT_CATALOG } from "../employees/talents";
import { syncTalentCatalog } from "./talent-sync";

interface RecordedCall {
  op: "nothing" | "update";
  values: Record<string, unknown>;
  set?: Record<string, unknown>;
}

function stubDb(calls: RecordedCall[]) {
  return {
    insert: (_table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoNothing: async () => {
          calls.push({ op: "nothing", values });
        },
        onConflictDoUpdate: async ({ set }: { set: Record<string, unknown> }) => {
          calls.push({ op: "update", values, set });
        },
      }),
    }),
  };
}

const PROFILES_DIR = join(
  process.cwd(),
  "core",
  "employee",
  "profiles"
);

describe("talent catalog sync", () => {
  it("upserts the 6 kernel talents with their departments", async () => {
    const calls: RecordedCall[] = [];
    const result = await syncTalentCatalog(stubDb(calls) as any, PROFILES_DIR);

    expect(result).toEqual({ count: 6 });

    const departments = calls.filter((c) => c.op === "nothing");
    expect(departments.map((c) => c.values.id).sort()).toEqual([
      "engineering",
      "operations",
      "research-data",
    ]);

    const talents = calls.filter((c) => c.op === "update");
    expect(talents.map((c) => c.values.spec).sort()).toEqual(
      Object.keys(TALENT_CATALOG).sort()
    );
    for (const talent of talents) {
      expect(talent.values.name).toBeTruthy();
      expect(talent.values.role).toBeTruthy();
      expect(talent.values.background).toBeTruthy();
      expect(talent.values.createdBy).toBe("Cofoundator");
      expect(talent.set?.updatedAt).toBeInstanceOf(Date);
    }
  });

  it("syncs the Atlas rich profile without touching the others", async () => {
    const calls: RecordedCall[] = [];
    await syncTalentCatalog(stubDb(calls) as any, PROFILES_DIR);

    const atlas = calls.find(
      (c) => c.op === "update" && c.values.spec === "atlas-software-engineer"
    );
    expect(atlas).toBeDefined();
    const values = (atlas?.values ?? {}) as Record<string, any>;
    expect(String(values.overview)).toContain("AI software engineer");
    expect(values.responsibilities).toHaveLength(5);
    expect(values.capabilities).toContain("Debugging");
    expect(values.tools).toHaveLength(3);
    expect(String(values.executionEnvironment)).toContain("assigned workspace");
    expect(values.boundaries).toHaveLength(7);
    expect(values.deliverables).toHaveLength(5);
    expect(String(values.verification)).toContain(
      "traceable engineering outcome"
    );
    // Meme contenu dans la clause de conflit (update).
    const set = (atlas?.set ?? {}) as Record<string, any>;
    expect(set.overview).toBe(values.overview);
    expect(set.tools).toBe(values.tools);

    // Nova : fiche riche synchronisee, sans write_file.
    const nova = calls.find(
      (c) => c.op === "update" && c.values.spec === "nova-devops-engineer"
    );
    expect(nova).toBeDefined();
    const novaValues = (nova?.values ?? {}) as Record<string, any>;
    expect(String(novaValues.overview)).toContain("DevOps engineer");
    expect(novaValues.responsibilities).toHaveLength(5);
    expect(novaValues.tools).toHaveLength(2);

    // Aria : fiche riche synchronisee.
    const aria = calls.find(
      (c) => c.op === "update" && c.values.spec === "aria-data-analyst"
    );
    expect(aria).toBeDefined();
    const ariaValues = (aria?.values ?? {}) as Record<string, any>;
    expect(String(ariaValues.overview)).toContain("data analyst");
    expect(ariaValues.responsibilities).toHaveLength(5);
    expect(ariaValues.tools).toHaveLength(2);

    // Newton : fiche riche synchronisee.
    const newton = calls.find(
      (c) => c.op === "update" && c.values.spec === "newton-researcher"
    );
    expect(newton).toBeDefined();
    const newtonValues = (newton?.values ?? {}) as Record<string, any>;
    expect(String(newtonValues.overview)).toContain("AI researcher");
    expect(newtonValues.responsibilities).toHaveLength(5);
    expect(newtonValues.tools).toHaveLength(2);

    // Talents non enrichis : aucune cle riche (jamais d'ecrasement NULL).
    const milo = calls.find(
      (c) => c.op === "update" && c.values.spec === "milo-content-strategist"
    );
    expect(milo).toBeDefined();
    expect("overview" in (milo?.values ?? {})).toBe(false);
    expect("overview" in (milo?.set ?? {})).toBe(false);
  });
});

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
});

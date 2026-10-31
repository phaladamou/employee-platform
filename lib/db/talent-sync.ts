// lib/db/talent-sync.ts
//
// Synchronise le catalogue des talents (table TalentProfile) depuis
// les specs du noyau (core/employee/profiles/*.json, lecture seule).
// Appelee par lib/db/migrate.ts sous tsx pur : volontairement SANS
// `server-only` (qui leve hors Next.js) et sans import de queries.ts.
// La connexion drizzle est injectee par l'appelant.
import { join } from "node:path";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import {
  loadCatalogSpecs,
  toTalentSeed,
  type TalentSeed,
} from "../employees/talents";
import { department, talentProfile } from "./schema";

type SyncDb = PostgresJsDatabase<any>;

async function ensureDepartments(db: SyncDb, ids: string[]): Promise<void> {
  for (const id of ids) {
    await db.insert(department).values({ id }).onConflictDoNothing();
  }
}

async function upsertTalents(db: SyncDb, seeds: TalentSeed[]): Promise<void> {
  for (const seed of seeds) {
    await db
      .insert(talentProfile)
      .values({
        spec: seed.spec,
        version: seed.version,
        name: seed.name,
        role: seed.role,
        departmentId: seed.departmentId,
        background: seed.background,
        allowedTools: seed.allowedTools,
        technologies: seed.technologies,
        createdBy: seed.createdBy,
      })
      .onConflictDoUpdate({
        target: talentProfile.spec,
        set: {
          version: seed.version,
          name: seed.name,
          role: seed.role,
          departmentId: seed.departmentId,
          background: seed.background,
          allowedTools: seed.allowedTools,
          technologies: seed.technologies,
          createdBy: seed.createdBy,
          updatedAt: new Date(),
        },
      });
  }
}

export async function syncTalentCatalog(
  db: SyncDb,
  profilesDir: string = join(process.cwd(), "core", "employee", "profiles")
): Promise<{ count: number }> {
  const seeds = loadCatalogSpecs(profilesDir).map(toTalentSeed);
  const departmentIds = [...new Set(seeds.map((seed) => seed.departmentId))];
  await ensureDepartments(db, departmentIds);
  await upsertTalents(db, seeds);
  return { count: seeds.length };
}

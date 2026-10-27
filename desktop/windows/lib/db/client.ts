// lib/db/client.ts
//
// Point d'entree unique vers la base de donnees.
//
// - Web (comportement historique) : PostgreSQL via `postgres` + drizzle.
// - Desktop (DESKTOP=1) : PostgreSQL embarquee via PGlite (fichier local,
//   aucune installation requise). Les migrations SQL historiques sont
//   appliquees automatiquement au premier acces.
import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import {
  drizzle as drizzlePglite,
  type PgliteDatabase,
} from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import {
  drizzle as drizzlePostgresJs,
  type PostgresJsDatabase,
} from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDesktopDataDir } from "@/lib/desktop/settings";

export function isDesktop(): boolean {
  return process.env.DESKTOP === "1";
}

// Les deux pilotes exposent la meme API de requetes drizzle (dialecte pg).
// Le type unique evite les unions inappelables sur les methodes generiques
// (ex. `.returning({...})`) ; la conversion se fait une fois dans getDb().
export type AppDb = PostgresJsDatabase<Record<string, never>>;

let postgresDb: PostgresJsDatabase<Record<string, never>> | null = null;

// Garde d'initialisation : les premiers appels concurrents partagent la
// meme promesse (deux instances PGlite sur le meme dossier = verrou corrompu).
let pgliteInitPromise: Promise<PgliteDatabase<Record<string, never>>> | null =
  null;

function getPostgresDb(): PostgresJsDatabase<Record<string, never>> {
  if (!postgresDb) {
    const client = postgres(process.env.POSTGRES_URL ?? "", {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
      keep_alive: 1,
    });
    postgresDb = drizzlePostgresJs(client);
  }
  return postgresDb;
}

function getMigrationsFolder(): string {
  if (process.env.DESKTOP_MIGRATIONS_DIR) {
    return process.env.DESKTOP_MIGRATIONS_DIR;
  }
  return path.join(process.cwd(), "lib", "db", "migrations");
}

async function getPgliteDb(): Promise<PgliteDatabase<Record<string, never>>> {
  if (!pgliteInitPromise) {
    pgliteInitPromise = (async () => {
      const dataDir = getDesktopDataDir();
      mkdirSync(dataDir, { recursive: true });
      const dbPath = path.join(dataDir, "db");
      const client = new PGlite(dbPath, {
        extensions: { pgcrypto },
      });
      // Requis par les migrations (gen_random_uuid()).
      await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
      const db = drizzlePglite(client);
      await migratePglite(db, {
        migrationsFolder: getMigrationsFolder(),
      });
      return db;
    })().catch((error: unknown) => {
      // Autorise une nouvelle tentative au prochain appel.
      pgliteInitPromise = null;
      throw error;
    });
  }
  return pgliteInitPromise;
}

/**
 * Retourne le client drizzle initialise (et migre en mode desktop).
 */
export async function getDb(): Promise<AppDb> {
  if (isDesktop()) {
    return (await getPgliteDb()) as unknown as AppDb;
  }
  return getPostgresDb();
}

// lib/db/client.ts
//
// Point d'entree unique vers la base de donnees.
// Web : PostgreSQL via `postgres` + drizzle.
import "server-only";

import {
  drizzle as drizzlePostgresJs,
  type PostgresJsDatabase,
} from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type AppDb = PostgresJsDatabase<Record<string, never>>;

let postgresDb: PostgresJsDatabase<Record<string, never>> | null = null;

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

/**
 * Retourne le client drizzle initialise.
 */
export async function getDb(): Promise<AppDb> {
  return getPostgresDb();
}

// lib/db/client.ts
//
// Point d'entree unique vers la base de donnees.
//
// Web et Desktop partagent la meme base PostgreSQL distante (POSTGRES_URL) :
// le bureau est une simple fenetre Electron sur l'application partagee,
// synchronisee avec le web en temps reel. Plus de base locale embarquee.
import "server-only";

import {
  drizzle as drizzlePostgresJs,
  type PostgresJsDatabase,
} from "drizzle-orm/postgres-js";
import postgres from "postgres";

export function isDesktop(): boolean {
  return process.env.DESKTOP === "1";
}

export type AppDb = PostgresJsDatabase<Record<string, never>>;

let postgresDb: PostgresJsDatabase<Record<string, never>> | null = null;

function getPostgresDb(): PostgresJsDatabase<Record<string, never>> {
  if (!postgresDb) {
    const url = process.env.POSTGRES_URL;
    if (!url) {
      throw new Error(
        "POSTGRES_URL is not defined (bureau : config embarquee absente ? dev : .env.local manquant ?)"
      );
    }
    const client = postgres(url, {
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

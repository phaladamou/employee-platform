// electron/test-user.mjs
//
// Compte jetable (credentials) pour les tests bureau : plus de provider
// guest, les tests creent un utilisateur directement en base puis le
// nettoient (avec ses chats/messages) en fin de test.
// Usage CI : import ... from "./test-user.mjs"
// Usage playwright : await import("../../electron/test-user.mjs")
import { randomBytes } from "node:crypto";

import bcryptTs from "bcrypt-ts";
import postgres from "postgres";

const { genSaltSync, hashSync } = bcryptTs;

export async function createTestUser() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL missing (test user creation)");
  }
  const email =
    `e2e-${Date.now()}-${randomBytes(4).toString("hex")}@example.invalid`;
  const password = randomBytes(24).toString("base64url");
  const sql = postgres(process.env.POSTGRES_URL, { max: 1 });
  try {
    const hash = hashSync(password, genSaltSync(10));
    const [row] = await sql`
      INSERT INTO "User" ("email", "password")
      VALUES (${email}, ${hash})
      RETURNING "id"
    `;
    return { email, password, userId: row.id };
  } finally {
    await sql.end();
  }
}

export async function deleteTestUser(userId) {
  if (!userId || !process.env.POSTGRES_URL) {
    return;
  }
  const sql = postgres(process.env.POSTGRES_URL, { max: 1 });
  try {
    // Ordre FK (contraintes "no action") : contenus -> chats -> user.
    // Best-effort : un nettoyage partiel ne doit pas faire echouer le test.
    const chats = await sql`
      SELECT "id" FROM "Chat" WHERE "userId" = ${userId}
    `.catch(() => []);
    for (const chat of chats) {
      await sql`DELETE FROM "Message_v2" WHERE "chatId" = ${chat.id}`.catch(
        () => undefined
      );
      await sql`DELETE FROM "Vote_v2" WHERE "chatId" = ${chat.id}`.catch(
        () => undefined
      );
      await sql`DELETE FROM "Stream" WHERE "chatId" = ${chat.id}`.catch(
        () => undefined
      );
      await sql`DELETE FROM "Chat" WHERE "id" = ${chat.id}`.catch(
        () => undefined
      );
    }
    await sql`DELETE FROM "User" WHERE "id" = ${userId}`.catch(() => undefined);
  } finally {
    await sql.end();
  }
}

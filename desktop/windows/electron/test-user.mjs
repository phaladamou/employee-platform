// electron/test-user.mjs
//
// Compte jetable (credentials) pour les tests bureau : plus de provider
// guest, les tests creent un utilisateur directement en base puis le
// nettoient (avec ses chats/messages) en fin de test.
// Schema actuel : User.accountId NOT NULL (comptes tenants) -> le user
// jetable est cree avec son Account (provisionnement minimal) et onboarded.
// Usage CI : import ... from "./test-user.mjs"
// Usage playwright : await import("../../electron/test-user.mjs")
import { randomBytes } from "node:crypto";

import { genSaltSync, hashSync } from "bcrypt-ts";
import postgres from "postgres";

export async function createTestUser() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL missing (test user creation)");
  }
  const stamp = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const email = `e2e-${stamp}@example.invalid`;
  const password = randomBytes(24).toString("base64url");
  const sql = postgres(process.env.POSTGRES_URL, { max: 1 });
  try {
    const hash = hashSync(password, genSaltSync(10));
    const [account] = await sql`
      INSERT INTO "Account" ("name")
      VALUES (${`e2e-${stamp}`})
      RETURNING "id"
    `;
    const [row] = await sql`
      INSERT INTO "User" ("email", "password", "accountId", "onboarded")
      VALUES (${email}, ${hash}, ${account.id}, true)
      RETURNING "id"
    `;
    return { email, password, userId: row.id, accountId: account.id };
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
    // Compte tenant (FK "restrict" depuis User) : lu avant suppression
    // du user, supprime apres (les employes partent en cascade).
    const users = await sql`
      SELECT "accountId" FROM "User" WHERE "id" = ${userId}
    `.catch(() => []);
    await sql`DELETE FROM "User" WHERE "id" = ${userId}`.catch(() => undefined);
    const accountId = users?.[0]?.accountId;
    if (accountId) {
      await sql`DELETE FROM "Account" WHERE "id" = ${accountId}`.catch(
        () => undefined
      );
    }
  } finally {
    await sql.end();
  }
}

// lib/db/chat-scope.test.ts
// Non-regression : l'historique principal (espace Chef) exclut les
// sessions employe (table Chat partagee, employeeId renseigne).
// Le SQL est capture via le mock pg-proxy de drizzle, sans base.
// Execution : node --test lib/db/chat-scope.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { drizzle } from "drizzle-orm/pg-proxy";

import { chat, userMainChatsCondition } from "./schema.ts";

async function capturedWhere() {
  const seen: Array<{ sql: string; params: unknown[] }> = [];
  const db = drizzle(async (sql, params) => {
    seen.push({ sql, params: params as unknown[] });
    return { rows: [] };
  });
  await db
    .select()
    .from(chat)
    .where(userMainChatsCondition("user-1"));
  assert.equal(seen.length, 1);
  return seen[0];
}

describe("userMainChatsCondition", () => {
  it("excludes employee sessions from main history SQL", async () => {
    const { sql, params } = await capturedWhere();
    assert.match(sql, /"Chat"\."employeeId" is null/);
    assert.match(sql, /"Chat"\."userId" = \$1/);
    assert.deepEqual(params, ["user-1"]);
  });
});

// lib/server/employee-history.test.ts
// Execution : node --test lib/server/employee-history.test.ts
// (fonctions pures uniquement : jamais d'appel LLM ici).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SESSION_HISTORY_MAX_CHARS,
  SESSION_HISTORY_MAX_TURNS,
  buildSessionHistory,
} from "./employee-history.ts";

function row(role: string, text: string): { role: string; text: string } {
  return { role, text };
}

describe("buildSessionHistory", () => {
  it("maps user rows to user and everything else to assistant", () => {
    const turns = buildSessionHistory([
      row("user", "hello"),
      row("assistant", "hi"),
      row("employee", "working"),
    ]);

    assert.deepEqual(
      turns.map((turn) => turn.role),
      ["user", "assistant", "assistant"]
    );
  });

  it("excludes the trailing row when asked (prompt passe separement)", () => {
    const turns = buildSessionHistory(
      [row("user", "discussed"), row("user", "current prompt")],
      { excludeLast: true }
    );

    assert.deepEqual(
      turns.map((turn) => turn.text),
      ["discussed"]
    );
  });

  it("keeps only the most recent turns, bounded", () => {
    const rows = Array.from({ length: SESSION_HISTORY_MAX_TURNS + 4 }, (_, i) =>
      row("user", `turn ${i}`)
    );

    const turns = buildSessionHistory(rows);

    assert.equal(turns.length, SESSION_HISTORY_MAX_TURNS);
    assert.equal(turns[0]?.text, "turn 4");
    assert.equal(turns.at(-1)?.text, `turn ${SESSION_HISTORY_MAX_TURNS + 3}`);
  });

  it("truncates long texts and drops empties", () => {
    const turns = buildSessionHistory([
      row("user", "   "),
      row("user", `x${"y".repeat(SESSION_HISTORY_MAX_CHARS + 100)}`),
    ]);

    assert.equal(turns.length, 1);
    assert.equal(turns[0]?.text.length, SESSION_HISTORY_MAX_CHARS);
    assert.ok(turns[0]?.text.startsWith("x"));
  });

  it("returns an empty history for an empty session", () => {
    assert.deepEqual(buildSessionHistory([]), []);
    assert.deepEqual(buildSessionHistory([row("user", "only")], {
      excludeLast: true,
    }), []);
  });
});

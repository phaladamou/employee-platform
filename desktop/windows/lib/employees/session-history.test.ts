// lib/employees/session-history.test.ts
// Contrat du mapping historique -> bulles de discussion.
// Execution : node --test lib/employees/session-history.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { mapSessionHistory } from "./session-history.ts";

const FALLBACKS = { emptyReply: "(vide)", needsAcceptance: "(relire)" };

describe("mapSessionHistory", () => {
  it("maps employee and user rows, unknown roles fall back to user", () => {
    assert.deepEqual(
      mapSessionHistory(
        [
          { id: "a", role: "user", text: "bonjour", missionId: null },
          { id: "b", role: "employee", text: "salut", missionId: null },
          { id: "c", role: "assistant", text: "brut", missionId: null },
        ],
        FALLBACKS
      ),
      [
        { id: "a", role: "user", text: "bonjour" },
        { id: "b", role: "employee", text: "salut" },
        { id: "c", role: "user", text: "brut" },
      ]
    );
  });

  it("falls back on empty text, acceptance label when linked to a mission", () => {
    assert.deepEqual(
      mapSessionHistory(
        [
          { id: "a", role: "user", text: "", missionId: null },
          { id: "b", role: "employee", text: "", missionId: "m1" },
        ],
        FALLBACKS
      ),
      [
        { id: "a", role: "user", text: "(vide)" },
        { id: "b", role: "employee", text: "(relire)", missionId: "m1" },
      ]
    );
  });

  it("passes mission ids through and keeps order", () => {
    assert.deepEqual(
      mapSessionHistory(
        [
          { id: "a", role: "user", text: "fais X", missionId: null },
          { id: "b", role: "employee", text: "fait", missionId: "m9" },
        ],
        FALLBACKS
      ),
      [
        { id: "a", role: "user", text: "fais X" },
        { id: "b", role: "employee", text: "fait", missionId: "m9" },
      ]
    );
  });

  it("maps an empty history to no bubbles", () => {
    assert.deepEqual(mapSessionHistory([], FALLBACKS), []);
  });
});

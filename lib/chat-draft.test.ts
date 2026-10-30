// lib/chat-draft.test.ts
// Contrat : le brouillon du champ chat est scope par compte — deux
// comptes ne partagent jamais la meme cle, et l'ancienne cle globale
// "input" n'est plus utilisee pour lire.
// Execution : node --test lib/chat-draft.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ANONYMOUS_DRAFT_KEY,
  LEGACY_DRAFT_KEY,
  draftKeyForUser,
} from "./chat-draft.ts";

describe("draftKeyForUser", () => {
  it("scope la cle par identifiant utilisateur", () => {
    assert.equal(draftKeyForUser("user-ada"), "input:user-ada");
  });

  it("deux comptes ont deux cles differentes (pas de fuite)", () => {
    assert.notEqual(draftKeyForUser("user-ada"), draftKeyForUser("user-bob"));
  });

  it("sans utilisateur : cle anonyme dediee, jamais la cle globale", () => {
    assert.equal(draftKeyForUser(undefined), ANONYMOUS_DRAFT_KEY);
    assert.notEqual(draftKeyForUser(undefined), LEGACY_DRAFT_KEY);
  });

  it("la cle legacy documentee est l'ancienne cle globale", () => {
    assert.equal(LEGACY_DRAFT_KEY, "input");
  });
});

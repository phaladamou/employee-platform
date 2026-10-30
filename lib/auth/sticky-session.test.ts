// lib/auth/sticky-session.test.ts
// Contrat de la session "sticky" : une coupure reseau/serveur ne doit
// jamais afficher l'etat "non connecte" ni vider l'historique.
// Execution : node --test lib/auth/sticky-session.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  classifySessionProbe,
  clearStickyUser,
  readMemoryUser,
  readStoredUser,
  resolveStickySession,
  writeMemoryUser,
} from "./sticky-session.ts";

const ADA = {
  id: "user-ada",
  email: "ada@example.com",
  name: "Ada Lovelace",
  image: null,
  type: "regular",
} as const;

const BOB = {
  id: "user-bob",
  email: "bob@example.com",
  name: "Bob",
  image: null,
  type: "regular",
} as const;

describe("resolveStickySession", () => {
  it("session live authentifiee : gagne et devient la reference", () => {
    assert.deepEqual(
      resolveStickySession({
        liveStatus: "authenticated",
        liveUser: ADA,
        storedUser: null,
        logoutConfirmed: false,
      }),
      { user: ADA, status: "authenticated", persistUser: ADA }
    );
  });

  it("changement de compte live : suit le live, pas le stocke", () => {
    assert.deepEqual(
      resolveStickySession({
        liveStatus: "authenticated",
        liveUser: BOB,
        storedUser: ADA,
        logoutConfirmed: false,
      }),
      { user: BOB, status: "authenticated", persistUser: BOB }
    );
  });

  it("bascule suspecte (serveur coupe) : reste affiche connecte", () => {
    assert.deepEqual(
      resolveStickySession({
        liveStatus: "unauthenticated",
        liveUser: null,
        storedUser: ADA,
        logoutConfirmed: false,
      }),
      { user: ADA, status: "authenticated", persistUser: ADA }
    );
  });

  it("logout confirme par le serveur : affiche non connecte", () => {
    assert.deepEqual(
      resolveStickySession({
        liveStatus: "unauthenticated",
        liveUser: null,
        storedUser: ADA,
        logoutConfirmed: true,
      }),
      { user: undefined, status: "unauthenticated", persistUser: null }
    );
  });

  it("jamais connecte : reste non connecte", () => {
    assert.deepEqual(
      resolveStickySession({
        liveStatus: "unauthenticated",
        liveUser: null,
        storedUser: null,
        logoutConfirmed: false,
      }),
      { user: undefined, status: "unauthenticated", persistUser: null }
    );
  });

  it("chargement avec reference connue : garde l'utilisateur, statut loading", () => {
    assert.deepEqual(
      resolveStickySession({
        liveStatus: "loading",
        liveUser: null,
        storedUser: ADA,
        logoutConfirmed: false,
      }),
      { user: ADA, status: "loading", persistUser: ADA }
    );
  });

  it("chargement sans reference : loading sans utilisateur", () => {
    assert.deepEqual(
      resolveStickySession({
        liveStatus: "loading",
        liveUser: null,
        storedUser: null,
        logoutConfirmed: false,
      }),
      { user: undefined, status: "loading", persistUser: null }
    );
  });

  it("live authentifie sans utilisateur (defensif) : garde le stocke", () => {
    assert.deepEqual(
      resolveStickySession({
        liveStatus: "authenticated",
        liveUser: null,
        storedUser: ADA,
        logoutConfirmed: false,
      }),
      { user: ADA, status: "authenticated", persistUser: ADA }
    );
  });
});

describe("readStoredUser", () => {
  it("hors navigateur (Node) : retourne null sans lever", () => {
    assert.equal(readStoredUser(), null);
  });
});

describe("classifySessionProbe", () => {
  it("503 proxy (serveur coupe) : reste sticky", () => {
    assert.equal(
      classifySessionProbe({ ok: false, body: null, parseFailed: false }),
      "inconclusive"
    );
  });

  it("401 : reste sticky (pas une preuve de logout)", () => {
    assert.equal(
      classifySessionProbe({ ok: false, body: {}, parseFailed: false }),
      "inconclusive"
    );
  });

  it("200 + page HTML non-JSON : reste sticky", () => {
    assert.equal(
      classifySessionProbe({
        ok: true,
        body: undefined,
        parseFailed: true,
      }),
      "inconclusive"
    );
  });

  it("200 + session vide : logout confirme", () => {
    assert.equal(
      classifySessionProbe({ ok: true, body: {}, parseFailed: false }),
      "logout-confirmed"
    );
  });

  it("200 + user null : logout confirme", () => {
    assert.equal(
      classifySessionProbe({
        ok: true,
        body: { user: null },
        parseFailed: false,
      }),
      "logout-confirmed"
    );
  });

  it("200 + session presente (provider en retard) : reste sticky", () => {
    assert.equal(
      classifySessionProbe({
        ok: true,
        body: { user: ADA },
        parseFailed: false,
      }),
      "inconclusive"
    );
  });
});

describe("memoire module", () => {
  it("round-trip : ecrit puis relit la reference", () => {
    writeMemoryUser(ADA);
    assert.deepEqual(readMemoryUser(), ADA);
    writeMemoryUser(null);
    assert.equal(readMemoryUser(), null);
  });

  it("clearStickyUser : purge la memoire module", () => {
    writeMemoryUser(ADA);
    clearStickyUser();
    assert.equal(readMemoryUser(), null);
  });
});

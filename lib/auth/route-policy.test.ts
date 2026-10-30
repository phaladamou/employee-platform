// lib/auth/route-policy.test.ts
// Contrat du middleware auth (dont le comportement apres logout).
// Execution : node --test lib/auth/route-policy.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { decideRoute } from "./route-policy.ts";

describe("decideRoute", () => {
  it("logout : /login sans session laisse passer (pas de rebond)", () => {
    assert.deepEqual(decideRoute("/login", "", false), { action: "next" });
  });

  it("/login avec session redirige vers /workspace", () => {
    assert.deepEqual(decideRoute("/login", "", true), {
      action: "redirect",
      location: "/workspace",
    });
  });

  it("/workspace sans session redirige vers /login avec callbackUrl", () => {
    assert.deepEqual(decideRoute("/workspace", "", false), {
      action: "redirect",
      location: "/login?callbackUrl=%2Fworkspace",
    });
  });

  it("/workspace avec session laisse passer", () => {
    assert.deepEqual(decideRoute("/workspace", "", true), { action: "next" });
  });

  it("API protegee sans session -> 401", () => {
    assert.deepEqual(decideRoute("/api/chat", "", false), {
      action: "unauthorized",
    });
  });

  it("/api/auth/* reste public meme sans session", () => {
    assert.deepEqual(decideRoute("/api/auth/session", "", false), {
      action: "next",
    });
  });

  it("/register avec session redirige vers /workspace", () => {
    assert.deepEqual(decideRoute("/register", "", true), {
      action: "redirect",
      location: "/workspace",
    });
  });

  it("/onboarding sans session redirige vers /login (etape email d'abord)", () => {
    assert.deepEqual(decideRoute("/onboarding", "", false), {
      action: "redirect",
      location: "/login?callbackUrl=%2Fonboarding",
    });
  });

  it("/onboarding avec session laisse passer (la page tranche ensuite)", () => {
    assert.deepEqual(decideRoute("/onboarding", "", true), {
      action: "next",
    });
  });

  it("POST /api/onboarding sans session -> 401", () => {
    assert.deepEqual(decideRoute("/api/onboarding", "", false), {
      action: "unauthorized",
    });
  });

  it("favicons et icones metadata restent publics sans session", () => {
    for (const pathname of [
      "/favicon.ico",
      "/icon.svg",
      "/apple-icon.png",
    ]) {
      assert.deepEqual(decideRoute(pathname, "", false), { action: "next" });
    }
  });
});

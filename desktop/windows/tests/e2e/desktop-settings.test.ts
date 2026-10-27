import { type APIRequestContext, expect, test } from "@playwright/test";

// Couverture API du mode bureau (PGlite embarquee, pas de Postgres).
// Execution : DESKTOP=1 pnpm exec playwright test desktop-settings
// (le webServer demarre alors `pnpm dev` avec DESKTOP=1, voir
// playwright.config.ts). Ignoree en mode web.
test.describe("Desktop settings API", () => {
  // Serial : les POST paralleles pendant la (re)compilation dev de la route
  // auth sont abandonnes par Turbopack (connexions coupees avant handler).
  test.describe.configure({ mode: "serial" });

  test.beforeEach(() => {
    test.skip(process.env.DESKTOP !== "1", "desktop-mode only");
  });

  async function guestSignIn(request: APIRequestContext) {
    const csrfRes = await request.get("/api/auth/csrf");
    expect(csrfRes.ok()).toBeTruthy();
    const { csrfToken } = await csrfRes.json();
    // X-Auth-Return-Redirect : le serveur repond JSON 200 + cookies
    // au lieu de rediriger (aucune page lourde a compiler).
    // Timeout large : premier appel = init PGlite + migrations + hash bcrypt.
    const callbackRes = await request.post("/api/auth/callback/guest", {
      headers: { "X-Auth-Return-Redirect": "1" },
      form: { csrfToken, callbackUrl: "/workspace" },
      timeout: 120_000,
    });
    expect(callbackRes.ok()).toBeTruthy();
    const sessionRes = await request.get("/api/auth/session");
    expect(sessionRes.ok()).toBeTruthy();
    const session = await sessionRes.json();
    expect(session?.user?.id).toBeTruthy();
  }

  test("gate: unauthenticated API access is rejected", async ({ request }) => {
    const res = await request.get("/api/desktop/settings");
    expect(res.status()).toBe(401);
  });

  test("settings flow: read, save, masked read", async ({ request }) => {
    await guestSignIn(request);

    const before = await request.get("/api/desktop/settings");
    expect(before.status()).toBe(200);
    const initial = await before.json();
    expect(initial.configured).toBe(false);
    expect(initial.llmBaseUrl).toContain("http");

    const save = await request.post("/api/desktop/settings", {
      data: {
        llmApiKey: "sk-test-playwright-0123456789",
        llmBaseUrl: "https://api.deepseek.com/v1",
      },
    });
    expect(save.status()).toBe(200);

    const after = await request.get("/api/desktop/settings");
    expect(after.status()).toBe(200);
    const saved = await after.json();
    expect(saved.configured).toBe(true);
    expect(saved.llmApiKey).toContain("••");
    expect(JSON.stringify(saved)).not.toContain("playwright");
  });

  test("settings validation: bad base URL is rejected", async ({
    request,
  }) => {
    await guestSignIn(request);

    const res = await request.post("/api/desktop/settings", {
      data: { llmBaseUrl: "not-a-url" },
    });
    expect(res.status()).toBe(400);
  });
});

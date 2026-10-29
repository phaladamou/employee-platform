import { type APIRequestContext, expect, test } from "@playwright/test";

// Couverture API du mode bureau (Postgres distant partage avec le web).
// Execution : DESKTOP=1 pnpm exec playwright test desktop-settings
// (le webServer demarre alors `pnpm dev` avec DESKTOP=1, voir
// playwright.config.ts ; POSTGRES_URL requis, ex. via .env.local).
// Ignoree en mode web. Le signin utilise un compte jetable (credentials)
// cree puis supprime en base (plus de provider guest).
test.describe("Desktop settings API", () => {
  // Serial : les POST paralleles pendant la (re)compilation dev de la route
  // auth sont abandonnes par Turbopack (connexions coupees avant handler).
  test.describe.configure({ mode: "serial" });

  test.beforeEach(() => {
    test.skip(process.env.DESKTOP !== "1", "desktop-mode only");
  });

  // Connecte un compte jetable (credentials) ; retourne son nettoyage
  // (a appeler en fin de test, la session JWT survivrait sinon sans user).
  async function credentialsSignIn(
    request: APIRequestContext
  ): Promise<() => Promise<void>> {
    // Import dynamique : ce test CommonJS ne peut pas requerir le .mjs.
    const { createTestUser, deleteTestUser } = await import(
      "../../electron/test-user.mjs"
    );
    const testUser = await createTestUser();
    const csrfRes = await request.get("/api/auth/csrf");
    expect(csrfRes.ok()).toBeTruthy();
    const { csrfToken } = await csrfRes.json();
    // X-Auth-Return-Redirect : le serveur repond JSON 200 + cookies
    // au lieu de rediriger (aucune page lourde a compiler).
    // Timeout large : premier appel = compilation dev + round-trip DB + hash bcrypt.
    const callbackRes = await request.post("/api/auth/callback/credentials", {
      headers: { "X-Auth-Return-Redirect": "1" },
      form: {
        csrfToken,
        email: testUser.email,
        password: testUser.password,
        callbackUrl: "/workspace",
      },
      timeout: 120_000,
    });
    expect(callbackRes.ok()).toBeTruthy();
    const sessionRes = await request.get("/api/auth/session");
    expect(sessionRes.ok()).toBeTruthy();
    const session = await sessionRes.json();
    expect(session?.user?.id).toBeTruthy();
    return () => deleteTestUser(testUser.userId);
  }

  test("gate: unauthenticated API access is rejected", async ({ request }) => {
    const res = await request.get("/api/desktop/settings");
    expect(res.status()).toBe(401);
  });

  test("settings flow: read, save, masked read", async ({ request }) => {
    const cleanup = await credentialsSignIn(request);
    try {
        const before = await request.get("/api/desktop/settings");
      expect(before.status()).toBe(200);
      const initial = await before.json();
      expect(initial.configured).toBe(false);
      expect(initial.llmBaseUrl).toContain("http");

      const save = await request.post("/api/desktop/settings", {
        data: {
          llmApiKey: "[REDACTED]",
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
    } finally {
      await cleanup();
    }
  });

  test("settings validation: bad base URL is rejected", async ({
    request,
  }) => {
    const cleanup = await credentialsSignIn(request);
    try {
      const res = await request.post("/api/desktop/settings", {
        data: { llmBaseUrl: "not-a-url" },
      });
      expect(res.status()).toBe(400);
    } finally {
      await cleanup();
    }
  });
});

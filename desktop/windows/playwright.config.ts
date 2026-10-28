import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import { config } from "dotenv";

config({
  path: ".env.local",
});

/* Use process.env.PORT by default and fallback to port 3000 */
const PORT = process.env.PORT || 3000;

/**
 * Set webServer.url and use.baseURL with the location
 * of the WebServer respecting the correct set port.
 * Desktop mode binds 127.0.0.1 explicitly: `localhost` may resolve to ::1
 * first and break or stall API clients (ECONNREFUSED / hung POSTs).
 */
const testHost = process.env.DESKTOP === "1" ? "127.0.0.1" : "localhost";
const baseURL = `http://${testHost}:${PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: 0,
  /* Limit workers to prevent browser crashes */
  workers: process.env.CI ? 2 : 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "retain-on-failure",
  },

  /* Configure global timeout for each test */
  timeout: 240 * 1000, // 120 seconds
  expect: {
    timeout: 240 * 1000,
  },

  /* Configure projects */
  projects: [
    {
      name: "e2e",
      testMatch: /e2e\/.*.test.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests.
     With DESKTOP=1 the server boots in desktop mode (online, POSTGRES_URL
     required, e.g. via .env.local) for tests/e2e/desktop-settings.test.ts. */
  webServer: {
    // Mode bureau : bind 127.0.0.1 (avec 0.0.0.0, Auth.js emet des
    // redirects vers http://0.0.0.0 que personne ne peut suivre) et moteur
    // webpack (Turbopack dev coupe les POST auth sur base vierge).
    command:
      process.env.DESKTOP === "1"
        ? "pnpm exec next dev -H 127.0.0.1"
        : "pnpm dev",
    url: `${baseURL}/ping`,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...(process.env.DESKTOP === "1"
        ? {
            DESKTOP: "1",
            // Hors du projet : le settings.json de test ne doit pas
            // perturber le watcher du serveur dev.
            DESKTOP_DATA_DIR: `${process.env.TMPDIR || "/tmp"}/pw-desktop-test`,
            NEXT_PUBLIC_DESKTOP: "1",
            AUTH_SECRET: "playwright-desktop-test-secret-0123456789",
          }
        : {}),
    },
  },
});

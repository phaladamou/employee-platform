// electron/main.ts
//
// Processus principal de l'application bureau Employee (Windows).
// En production, le serveur Next.js (build standalone) est lance en
// processus embarque, puis une fenetre pointe vers http://127.0.0.1:PORT.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { app, BrowserWindow } from "electron";

const isDev = process.env.ELECTRON_DEV === "1";

interface DesktopSettingsFile {
  llmApiKey?: string;
  llmBaseUrl?: string;
  tavilyApiKey?: string;
  authSecret?: string;
}

function getDataDir(): string {
  if (process.env.DESKTOP_DATA_DIR) {
    return process.env.DESKTOP_DATA_DIR;
  }
  return path.join(app.getPath("userData"), "data");
}

function loadSettings(dataDir: string): DesktopSettingsFile {
  try {
    const file = path.join(dataDir, "settings.json");
    if (!existsSync(file)) {
      return {};
    }
    return JSON.parse(readFileSync(file, "utf8")) as DesktopSettingsFile;
  } catch {
    return {};
  }
}

function ensureAuthSecret(
  dataDir: string,
  settings: DesktopSettingsFile
): string {
  if (settings.authSecret) {
    return settings.authSecret;
  }
  const authSecret = randomBytes(32).toString("base64url");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    path.join(dataDir, "settings.json"),
    JSON.stringify({ ...settings, authSecret }, null, 2)
  );
  return authSecret;
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port =
        typeof address === "object" && address ? address.port : 0;
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve(port);
        }
      });
    });
    server.on("error", reject);
  });
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      // Toute reponse HTTP (y compris 401/404) prouve que le serveur repond.
      await fetch(url);
      return;
    } catch {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Embedded server did not start in time (${url})`);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

async function startEmbeddedServer(
  port: number,
  dataDir: string
): Promise<void> {
  const settings = loadSettings(dataDir);
  const authSecret = ensureAuthSecret(dataDir, settings);

  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  process.env.PORT = String(port);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.DESKTOP = "1";
  process.env.DESKTOP_DATA_DIR = dataDir;
  process.env.DESKTOP_MIGRATIONS_DIR = path.join(
    process.resourcesPath,
    "standalone",
    "migrations"
  );
  process.env.AUTH_SECRET = authSecret;
  if (settings.llmApiKey && !process.env.DEEPSEEK_API_KEY) {
    process.env.DEEPSEEK_API_KEY = settings.llmApiKey;
  }
  if (settings.llmBaseUrl && !process.env.OPENAI_BASE_URL) {
    process.env.OPENAI_BASE_URL = settings.llmBaseUrl;
  }
  if (settings.tavilyApiKey && !process.env.TAVILY_API_KEY) {
    process.env.TAVILY_API_KEY = settings.tavilyApiKey;
  }

  const entry = path.join(process.resourcesPath, "standalone", "server.js");
  if (!existsSync(entry)) {
    throw new Error(`Embedded server not found: ${entry}`);
  }

  // Le serveur standalone Next.js ecoute des son chargement.
  require(entry);
}

let mainWindow: BrowserWindow | null = null;

function createWindow(url: string): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(url);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

async function main(): Promise<void> {
  await app.whenReady();
  app.setAppUserModelId("com.employee.app");

  const dataDir = getDataDir();
  mkdirSync(dataDir, { recursive: true });

  if (isDev) {
    const port = Number(process.env.PORT ?? 3000);
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForServer(`${baseUrl}/api/models`, 120_000);
    createWindow(`${baseUrl}/workspace`);
    return;
  }

  const port = await getFreePort();
  if (!port) {
    throw new Error("Could not allocate a free port");
  }
  await startEmbeddedServer(port, dataDir);
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(`${baseUrl}/api/models`, 120_000);
  createWindow(`${baseUrl}/workspace`);
}

main().catch((error: unknown) => {
  console.error("[employee-desktop]", error);
  app.exit(1);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

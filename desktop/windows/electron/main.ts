// electron/main.ts
//
// Processus principal de l'application bureau Employee (Windows).
// En production, le serveur Next.js (build standalone) est lance en
// processus embarque, puis une fenetre pointe vers http://127.0.0.1:PORT.
// Le bureau est 100 % en ligne : memes donnees distantes que le web.
// Mises a jour auto via les Releases GitHub (electron-updater).
import { randomBytes } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import path from "node:path";
import { app, BrowserWindow, dialog, Menu } from "electron";
import { autoUpdater } from "electron-updater";

const isDev = process.env.ELECTRON_DEV === "1";

// Journal de demarrage : %APPDATA%/Employee/startup.log (Windows).
// Sans lui, un echec de boot est invisible (processus vivant, pas de fenetre).
let logFile = "";

function log(message: string): void {
  console.log(`[employee-desktop] ${message}`);
  if (logFile) {
    try {
      appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`);
    } catch {
      // Log fichier best-effort (console en secours).
    }
  }
}

function initLogFile(): string {
  try {
    const file = path.join(app.getPath("userData"), "startup.log");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `Employee startup log — ${new Date().toISOString()}\n`);
    return file;
  } catch {
    return "";
  }
}

// Le serveur embarque tourne dans CE processus : ses crashs async (boot
// Next, listen, requetes DB) arrivent ici. On les journalise au lieu de
// mourir en silence (le timeout de waitForServer affichera ensuite le
// dialogue d'erreur).
process.on("unhandledRejection", (reason: unknown) => {
  log(`UNHANDLED REJECTION: ${String(reason)}`);
});
process.on("uncaughtException", (error: Error) => {
  log(`UNCAUGHT EXCEPTION: ${error.stack ?? error.message}`);
});

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

// Bureau 100 % en ligne : l'URL Postgres vient de l'environnement (dev,
// override) ou du fichier embarque par la CI dans le standalone
// (desktop-env.json). Jamais de valeur en clair dans les logs.
function resolvePostgresUrl(): string {
  if (process.env.POSTGRES_URL) {
    log("POSTGRES_URL: from environment");
    return process.env.POSTGRES_URL;
  }
  const packaged = path.join(
    process.resourcesPath,
    "standalone",
    "desktop-env.json"
  );
  try {
    if (existsSync(packaged)) {
      const parsed = JSON.parse(readFileSync(packaged, "utf8")) as {
        postgresUrl?: unknown;
      };
      if (typeof parsed.postgresUrl === "string" && parsed.postgresUrl) {
        log("POSTGRES_URL: from packaged desktop-env.json");
        return parsed.postgresUrl;
      }
    }
  } catch (error) {
    log(`packaged desktop-env.json unreadable: ${String(error)}`);
  }
  throw new Error(
    "POSTGRES_URL is missing (packaged config absent and no environment override)"
  );
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
  log(`waiting for embedded server: ${url}`);
  for (let attempt = 0; ; attempt++) {
    try {
      // Toute reponse HTTP (y compris 401/404) prouve que le serveur repond.
      await fetch(url);
      log(`embedded server answered after ${attempt + 1} attempt(s)`);
      return;
    } catch {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Embedded server did not start in time (${url})`);
      }
      if (attempt > 0 && attempt % 40 === 0) {
        log(`still waiting for embedded server (${attempt + 1} attempts)...`);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

// Mises a jour auto (Windows NSIS) : au demarrage, l'app interroge la
// derniere Release GitHub (via app-update.yml embarque), telecharge en
// fond et installe au redemarrage (notification OS). Fire-and-forget :
// une panne reseau ne doit jamais empecher le demarrage.
function setupAutoUpdate(): void {
  try {
    autoUpdater.on("checking-for-update", () => {
      log("[updater] checking for update...");
    });
    autoUpdater.on("update-available", (info) => {
      log(`[updater] update available: ${info.version}`);
    });
    autoUpdater.on("update-not-available", () => {
      log("[updater] up to date");
    });
    autoUpdater.on("error", (error: Error) => {
      log(`[updater] error: ${error?.message ?? String(error)}`);
    });
    autoUpdater.on("update-downloaded", (info) => {
      log(`[updater] downloaded ${info.version}, will install on quit`);
    });
    void autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    log(`[updater] setup failed: ${String(error)}`);
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
  // Force : le server.js standalone Next lit process.env.HOSTNAME au require
  // (defaut '0.0.0.0'). Boucle locale uniquement : Electron et le serveur
  // sont co-localises, rien ne doit ecouter sur le reseau.
  process.env.HOSTNAME = "127.0.0.1";
  process.env.DESKTOP = "1";
  process.env.DESKTOP_DATA_DIR = dataDir;
  process.env.AUTH_SECRET = authSecret;
  process.env.POSTGRES_URL = resolvePostgresUrl();
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
  log(`requiring embedded server: ${entry} (port=${port})`);

  // Le serveur standalone Next.js ecoute des son chargement.
  require(entry);
  log("embedded server module loaded");
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
  mainWindow.webContents.on("did-fail-load", (_event, code, desc, failedUrl) => {
    log(`did-fail-load: ${code} ${desc} (${failedUrl})`);
  });
  log(`window created for ${url}`);
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
  // Pas de barre de menu native (File/Edit/View...) : l'app est 100 % web UI.
  Menu.setApplicationMenu(null);

  logFile = initLogFile();
  log(
    `starting: app=${app.getVersion()} electron=${process.versions.electron} ` +
      `node=${process.versions.node} platform=${process.platform} resources=${process.resourcesPath}`
  );

  const dataDir = getDataDir();
  mkdirSync(dataDir, { recursive: true });
  log(`data dir: ${dataDir}`);

  if (isDev) {
    const port = Number(process.env.PORT ?? 3000);
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForServer(`${baseUrl}/api/models`, 120_000);
    createWindow(`${baseUrl}/workspace`);
    return;
  }

  log("allocating a free loopback port...");
  const port = await getFreePort();
  if (!port) {
    throw new Error("Could not allocate a free port");
  }
  log(`port allocated: ${port}`);
  await startEmbeddedServer(port, dataDir);
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(`${baseUrl}/api/models`, 120_000);
  createWindow(`${baseUrl}/workspace`);
  setupAutoUpdate();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  log(`FATAL: ${detail}`);
  try {
    // Bloquant : l'utilisateur lit l'erreur avant que l'app ne quitte.
    dialog.showErrorBox(
      "Employee failed to start",
      `${message}\n\nDetails: ${logFile || "(log unavailable)"}`
    );
  } catch {
    // ignore (fallback : process.exit ci-dessous)
  }
  app.exit(1);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

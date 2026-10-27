// lib/desktop/settings.ts
//
// Reglages locaux de l'application bureau (cle API, secret d'auth).
// Stockes dans un fichier JSON sous le dossier de donnees desktop :
// - production : <userData>/data/settings.json (resolu par Electron)
// - dev : ./.desktop-data/settings.json
import "server-only";

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface DesktopSettings {
  llmApiKey?: string;
  llmBaseUrl?: string;
  tavilyApiKey?: string;
  authSecret?: string;
}

const SETTINGS_FILE = "settings.json";

export function getDesktopDataDir(): string {
  if (process.env.DESKTOP_DATA_DIR) {
    return process.env.DESKTOP_DATA_DIR;
  }
  return path.join(process.cwd(), ".desktop-data");
}

function settingsPath(): string {
  return path.join(getDesktopDataDir(), SETTINGS_FILE);
}

let cache: { mtimeMs: number; settings: DesktopSettings } | null = null;

export function loadDesktopSettings(): DesktopSettings {
  try {
    const file = settingsPath();
    if (!existsSync(file)) {
      return {};
    }
    const mtimeMs = statSync(file).mtimeMs;
    if (cache && cache.mtimeMs === mtimeMs) {
      return cache.settings;
    }
    const parsed = JSON.parse(readFileSync(file, "utf8")) as DesktopSettings;
    const settings: DesktopSettings = {
      llmApiKey: typeof parsed.llmApiKey === "string" ? parsed.llmApiKey : undefined,
      llmBaseUrl: typeof parsed.llmBaseUrl === "string" ? parsed.llmBaseUrl : undefined,
      tavilyApiKey:
        typeof parsed.tavilyApiKey === "string" ? parsed.tavilyApiKey : undefined,
      authSecret:
        typeof parsed.authSecret === "string" ? parsed.authSecret : undefined,
    };
    cache = { mtimeMs, settings };
    return settings;
  } catch {
    return cache?.settings ?? {};
  }
}

export function saveDesktopSettings(
  patch: Partial<DesktopSettings>
): DesktopSettings {
  const dir = getDesktopDataDir();
  mkdirSync(dir, { recursive: true });

  const next: DesktopSettings = { ...loadDesktopSettings() };
  for (const [key, value] of Object.entries(patch)) {
    // Chaine vide ou undefined = conserver la valeur existante.
    if (typeof value === "string" && value.length > 0) {
      (next as Record<string, string>)[key] = value;
    }
  }

  writeFileSync(settingsPath(), JSON.stringify(next, null, 2), { mode: 0o600 });
  cache = null;
  applyDesktopSettingsToEnv(next);
  return next;
}

/**
 * Propage les reglages vers process.env pour que tous les consommateurs
 * existants (providers LLM, recherche web, auth) les voient sans redemarrage.
 */
export function applyDesktopSettingsToEnv(settings: DesktopSettings): void {
  if (settings.llmApiKey) {
    process.env.DEEPSEEK_API_KEY = settings.llmApiKey;
  }
  if (settings.llmBaseUrl) {
    process.env.OPENAI_BASE_URL = settings.llmBaseUrl;
  }
  if (settings.tavilyApiKey) {
    process.env.TAVILY_API_KEY = settings.tavilyApiKey;
  }
  if (settings.authSecret) {
    process.env.AUTH_SECRET = settings.authSecret;
  }
}

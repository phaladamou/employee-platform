// electron/dev.mjs
//
// `pnpm desktop:dev` : lance `next dev` (mode desktop) + Electron en parallele.
// Fonctionne sur Windows, macOS et Linux.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const port = process.env.PORT ?? "3000";
const dataDir = path.join(root, ".desktop-data");

// Miroir de electron/main.ts : NextAuth exige AUTH_SECRET. En dev on le
// genere une fois et on le persiste dans .desktop-data/settings.json.
function ensureDevAuthSecret() {
  if (process.env.AUTH_SECRET) {
    return process.env.AUTH_SECRET;
  }
  mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "settings.json");
  let settings = {};
  try {
    if (existsSync(file)) {
      settings = JSON.parse(readFileSync(file, "utf8"));
    }
  } catch {
    settings = {};
  }
  if (typeof settings.authSecret !== "string" || !settings.authSecret) {
    settings = {
      ...settings,
      authSecret: randomBytes(32).toString("base64url"),
    };
    writeFileSync(file, JSON.stringify(settings, null, 2));
  }
  return settings.authSecret;
}

const sharedEnv = {
  ...process.env,
  DESKTOP: "1",
  DESKTOP_DATA_DIR: dataDir,
  NEXT_PUBLIC_DESKTOP: "1",
  AUTH_SECRET: ensureDevAuthSecret(),
  PORT: port,
};

function run(name, command, args, env) {
  const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
  child.on("exit", (code, signal) => {
    console.log(`[${name}] exit code=${code} signal=${signal}`);
    shutdown(typeof code === "number" ? code : 1);
  });
  child.on("error", (error) => {
    console.error(`[${name}] failed to start:`, error.message);
    shutdown(1);
  });
  return child;
}

const children = [];

function shutdown(code) {
  for (const child of children.splice(0)) {
    try {
      child.kill();
    } catch {
      // ignore
    }
  }
  process.exitCode = code;
  setTimeout(() => process.exit(code), 500).unref?.();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

children.push(
  // 127.0.0.1 uniquement : avec 0.0.0.0, Auth.js genere des redirects vers
  // http://0.0.0.0 (inhospitalier, bloque par Chromium) et le serveur
  // serait expose au reseau local. Electron et le serveur sont co-localises.
  run("next", process.execPath, ["node_modules/next/dist/bin/next", "dev", "--turbo", "-H", "127.0.0.1"], sharedEnv),
  run(
    "electron",
    process.execPath,
    ["node_modules/electron/cli.js", "."],
    { ...sharedEnv, ELECTRON_DEV: "1" }
  )
);

// electron/smoke-packaged.mjs
//
// Gate anti-"Cannot find module" : demarre le serveur standalone FRAICHEMENT
// construit dans des conditions fideles a la prod installee, puis rampe
// toutes les routes pour forcer l'evaluation de chaque chunk serveur.
// Echec bruyant (exit 1) au moindre module manquant.
//
// Fidelite prod : le standalone est COPIE hors du projet (sinon Node
// resoudrait les modules manquants via le node_modules du projet parent
// et le test serait aveugle — exactement le piege rencontre en 3.1.x).
// Lance automatiquement en fin de `pnpm desktop:build`.
// Requiert POSTGRES_URL (le bureau est 100 % en ligne) : le signin guest
// cree un utilisateur guest dans la base distante partagee.
import { spawn } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.NO_PROXY = "127.0.0.1,localhost";
process.env.no_proxy = "127.0.0.1,localhost";
delete process.env.NODE_USE_ENV_PROXY;

const root = process.cwd();
const standaloneSrc = path.join(root, ".next", "standalone");
const probeDir = path.join(os.tmpdir(), "employee-pkg-probe");
const probeStandalone = path.join(probeDir, "standalone");
const probeData = path.join(probeDir, "data");
const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;

const MISS_PATTERN = /cannot find module|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND/i;

let failures = 0;
const warnings = [];
let child = null;

function killChild() {
  try {
    child?.kill();
  } catch {
    // ignore
  }
  child = null;
}

function fail(message) {
  failures++;
  console.error(`[smoke-packaged] FAIL: ${message}`);
}

function checkBody(label, status, body) {
  if (typeof body === "string" && MISS_PATTERN.test(body)) {
    fail(`${label}: HTTP ${status} with module-resolution error: ${body.slice(0, 200)}`);
    return false;
  }
  return true;
}

async function main() {
  if (!existsSync(path.join(standaloneSrc, "server.js"))) {
    fail("missing .next/standalone/server.js (run next build first)");
    process.exit(1);
  }
  if (!process.env.POSTGRES_URL) {
    fail("POSTGRES_URL missing (CI must provide the POSTGRES_URL Actions secret)");
    process.exit(1);
  }

  console.log("[smoke-packaged] copying standalone outside project...");
  rmSync(probeDir, { recursive: true, force: true });
  cpSync(standaloneSrc, probeStandalone, { recursive: true });

  // La config embarquee par build-standalone doit etre presente et renseignee
  // (jamais de valeur en clair dans les logs).
  const packagedEnv = path.join(probeStandalone, "desktop-env.json");
  if (!existsSync(packagedEnv)) {
    fail("missing standalone/desktop-env.json (build-standalone must embed POSTGRES_URL)");
    process.exit(1);
  }
  try {
    const parsed = JSON.parse(readFileSync(packagedEnv, "utf8"));
    if (typeof parsed.postgresUrl !== "string" || !parsed.postgresUrl) {
      fail("standalone/desktop-env.json has no postgresUrl");
      process.exit(1);
    }
    console.log(
      `[smoke-packaged] packaged desktop-env.json ok (postgresUrl len=${parsed.postgresUrl.length})`
    );
  } catch (error) {
    fail(`cannot parse standalone/desktop-env.json: ${error.message}`);
    process.exit(1);
  }

  const server = spawn("node", ["server.js"], {
    cwd: probeStandalone,
    env: {
      ...process.env,
      DESKTOP: "1",
      DESKTOP_DATA_DIR: probeData,
      NEXT_PUBLIC_DESKTOP: "1",
      AUTH_SECRET: "packaged-smoke-test-secret-0123456789abcdef",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOut = "";
  const onData = (d) => {
    serverOut = `${serverOut}${d}`.slice(-200000);
  };
  server.stdout.on("data", onData);
  server.stderr.on("data", onData);
  let serverExited = null;
  server.on("exit", (code, signal) => {
    serverExited = { code, signal };
  });
  child = server;
  const kill = () => {
    killChild();
  };
  const finish = (ok) => {
    if (MISS_PATTERN.test(serverOut)) {
      fail(`server output contains module-resolution error`);
      ok = false;
    }
    if (!ok) {
      console.error("[smoke-packaged] --- server output (tail) ---");
      console.error(serverOut.slice(-3000));
    }
    console.log(
      `[smoke-packaged] ${ok && failures === 0 ? "OK" : "FAILED"} ` +
        `(${failures} failure(s), ${warnings.length} warning(s))`
    );
    kill();
    process.exit(ok && failures === 0 ? 0 : 1);
  };
  const failFinish = (message) => {
    fail(message);
    finish(false);
  };
  setTimeout(() => failFinish("global timeout (8 min)"), 8 * 60 * 1000).unref?.();

  // 1. Attente du boot (exerce deja toute la chaine de require du serveur).
  let up = false;
  for (let i = 0; i < 45; i++) {
    if (serverExited) {
      failFinish(
        `server exited during boot (code=${serverExited.code} signal=${serverExited.signal})`
      );
      return;
    }
    try {
      const res = await fetch(`${BASE}/api/auth/providers`);
      if (res.status) {
        up = true;
        break;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (!up) {
    failFinish("server did not answer within 90s");
    return;
  }
  console.log("[smoke-packaged] server up, signing in as guest...");

  // 2. Session guest (exerce le Postgres distant + auth end-to-end).
  let cookies = "";
  const req = async (url, init = {}) => {
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      headers: { cookie: cookies, ...(init.headers ?? {}) },
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const pair = c.split(";")[0];
      const eq = pair.indexOf("=");
      const jar = new Map(
        cookies
          .split("; ")
          .filter(Boolean)
          .map((x) => {
            const j = x.indexOf("=");
            return [x.slice(0, j), x.slice(j + 1)];
          })
      );
      jar.set(pair.slice(0, eq), pair.slice(eq + 1));
      cookies = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    }
    return res;
  };

  const providers = await (await req(`${BASE}/api/auth/providers`)).json();
  if (!providers.credentials || !providers.guest || providers.google) {
    failFinish(`unexpected auth providers: ${Object.keys(providers)}`);
    return;
  }
  const { csrfToken } = await (await req(`${BASE}/api/auth/csrf`)).json();
  const callback = await req(`${BASE}/api/auth/callback/guest`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body: new URLSearchParams({ csrfToken, callbackUrl: "/workspace" }),
  });
  if (callback.status !== 200) {
    failFinish(`guest signin returned HTTP ${callback.status}`);
    return;
  }
  const session = await (await req(`${BASE}/api/auth/session`)).json();
  if (!session?.user?.id) {
    failFinish("guest session missing after signin");
    return;
  }
  console.log("[smoke-packaged] guest session ok, crawling routes...");

  // 3. Rampe exhaustive : chaque route evalue son chunk serveur.
  const manifestPath = path.join(
    probeStandalone,
    ".next",
    "app-path-routes-manifest.json"
  );
  let routes;
  if (existsSync(manifestPath)) {
    routes = Object.keys(JSON.parse(readFileSync(manifestPath, "utf8")));
  } else {
    warnings.push("app-path-routes-manifest.json missing, using fallback list");
    routes = [
      "/", "/login", "/register", "/workspace", "/settings", "/artefacts",
      "/websites", "/computer", "/search", "/notifications", "/cli",
      "/simulations", "/help", "/faq", "/terms", "/privacy", "/dpa",
      "/sub-processors", "/docs", "/api/models", "/api/auth/providers",
      "/api/auth/session", "/api/desktop/settings",
    ];
  }
  const toUrl = (route) =>
    route
      .replace(/\[\[\.\.\.[^\]]+\]\]/g, "")
      .replace(/\[\.\.\.[^\]]+\]/g, "t")
      .replace(/\[[^\]]+\]/g, "test") || "/";

  let crawled = 0;
  for (const route of routes) {
    if (serverExited) {
      failFinish(
        `server exited mid-crawl at ${route} (code=${serverExited.code} signal=${serverExited.signal})`
      );
      return;
    }
    const url = `${BASE}${toUrl(route)}`;
    try {
      const res = await req(url, { signal: AbortSignal.timeout(30000) });
      const body = await res.text();
      checkBody(`GET ${toUrl(route)}`, res.status, body);
      if (res.status >= 500) {
        warnings.push(`GET ${toUrl(route)} -> HTTP ${res.status} (non-module cause)`);
      }
      crawled++;
    } catch (error) {
      failFinish(`GET ${toUrl(route)} request failed: ${error.message}`);
      return;
    }
  }
  console.log(`[smoke-packaged] crawled ${crawled} route(s)`);
  for (const w of warnings.slice(0, 10)) {
    console.log(`[smoke-packaged] warn: ${w}`);
  }
  if (warnings.length > 10) {
    console.log(`[smoke-packaged] ... +${warnings.length - 10} more warning(s)`);
  }
  finish(true);
}

main().catch((error) => {
  console.error(`[smoke-packaged] FAIL: ${error?.stack ?? error}`);
  killChild();
  process.exit(1);
});

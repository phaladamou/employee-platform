// electron/e2e-chat.mjs
//
// Etape "E2E Chat Test" de la CI : demarre le serveur standalone FRAICHEMENT
// construit (copie hors projet, comme le fige smoke-packaged), y connecte un
// invite, envoie un message sur /api/chat et /websites/api/chat, et exige
// une reponse streamee. Le LLM est simule (CI_PLAYWRIGHT=1 -> ChatAgent
// emet E2E-CHAT-OK) : le test prouve le cablage de bout en bout (auth,
// routes, proxy interne, Core, protocole de stream), pas le fournisseur LLM.
//
// Fidelite prod : port NON-3000 (le bureau embarque ecoute sur un port
// aleatoire) et aucune variable *_BASE_URL (absente de l'app packagee) :
// tout appel code en dur vers localhost:3000 echoue ici.
// Requiert POSTGRES_URL (bureau 100 % en ligne).
// Fonctionne sur Windows, macOS et Linux.
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const standaloneSrc = path.join(root, ".next", "standalone");
const probeDir = path.join(os.tmpdir(), "employee-e2e-chat");
const probeStandalone = path.join(probeDir, "standalone");
const probeData = path.join(probeDir, "data");
const PORT = 3222;
const BASE = `http://127.0.0.1:${PORT}`;
const MARKER = "E2E-CHAT-OK";

let child = null;
let serverOut = "";
function killChild() {
  try {
    child?.kill();
  } catch {
    // ignore
  }
  child = null;
}

const failures = [];
function fail(step, detail) {
  failures.push(step);
  console.error(`[e2e-chat] FAIL: ${step} — ${detail}`);
}

function finish() {
  if (failures.length > 0) {
    console.error("[e2e-chat] --- server output (tail) ---");
    console.error(serverOut.slice(-4000));
    console.error(`[e2e-chat] FAILED (${failures.join(", ")})`);
    killChild();
    process.exit(1);
  }
  console.log("[e2e-chat] OK (guest + main chat + websites chat)");
  killChild();
  process.exit(0);
}

let cookies = "";
async function req(url, init = {}) {
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
}

async function readStream(res, timeoutMs) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const left = deadline - Date.now();
    if (left <= 0) return { text, timedOut: true };
    const next = await Promise.race([
      reader.read(),
      new Promise((resolve) =>
        setTimeout(() => resolve({ done: true, timeout: true }), Math.min(left, 30000))
      ),
    ]);
    if (next.done) break;
    if (next.value) text += decoder.decode(next.value, { stream: true });
  }
  text += decoder.decode();
  return { text, timedOut: false };
}

async function postChat(label, urlPath) {
  const body = {
    id: randomUUID(),
    message: {
      id: randomUUID(),
      role: "user",
      parts: [{ type: "text", text: "hello, reply briefly" }],
      attachments: [],
    },
    selectedChatModel: "moonshotai/kimi-k2.5",
    selectedVisibilityType: "private",
    mode: null,
  };
  let res;
  try {
    res = await req(`${BASE}${urlPath}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(150000),
    });
  } catch (error) {
    fail(label, `request failed: ${error.message}`);
    return;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    fail(label, `HTTP ${res.status}: ${text.slice(0, 300)}`);
    return;
  }
  const { text, timedOut } = await readStream(res, 120000);
  const hasDelta = text.includes("text-delta");
  const hasMarker = text.includes(MARKER);
  if (timedOut || !hasDelta || !hasMarker) {
    fail(
      label,
      `weak stream (timedOut=${timedOut} text-delta=${hasDelta} marker=${hasMarker}, ${text.length} chars): ${text.replace(/\n/g, "\\n").slice(0, 400)}`
    );
    return;
  }
  console.log(`[e2e-chat] PASS: ${label} (${text.length} chars streamed)`);
}

async function main() {
  if (!existsSync(path.join(standaloneSrc, "server.js"))) {
    fail("setup", "missing .next/standalone/server.js (run next build first)");
    finish();
    return;
  }
  if (!process.env.POSTGRES_URL) {
    fail("setup", "POSTGRES_URL missing");
    finish();
    return;
  }

  console.log("[e2e-chat] copying standalone outside project...");
  rmSync(probeDir, { recursive: true, force: true });
  cpSync(standaloneSrc, probeStandalone, { recursive: true });

  const server = spawn("node", ["server.js"], {
    cwd: probeStandalone,
    env: {
      ...process.env,
      DESKTOP: "1",
      DESKTOP_DATA_DIR: probeData,
      NEXT_PUBLIC_DESKTOP: "1",
      CI_PLAYWRIGHT: "1",
      AUTH_SECRET: "e2e-chat-test-secret-0123456789abcdef",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
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
  setTimeout(() => {
    fail("setup", "global timeout (8 min)");
    finish();
  }, 8 * 60 * 1000).unref?.();

  let up = false;
  for (let i = 0; i < 45; i++) {
    if (serverExited) break;
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
    fail("setup", serverExited ? `server exited (code=${serverExited.code})` : "server did not boot in 90s");
    finish();
    return;
  }
  console.log("[e2e-chat] server up, signing in as guest...");

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
    fail("guest signin", `HTTP ${callback.status}`);
    finish();
    return;
  }
  const session = await (await req(`${BASE}/api/auth/session`)).json();
  if (!session?.user?.id) {
    fail("guest session", "missing user id");
    finish();
    return;
  }
  console.log("[e2e-chat] PASS: guest signin + session");

  await postChat("main chat", "/api/chat");
  await postChat("websites chat", "/websites/api/chat");
  finish();
}

main().catch((error) => {
  fail("harness", error?.stack ?? String(error));
  finish();
});

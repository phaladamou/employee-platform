// electron/build.mjs
//
// `pnpm desktop:build` : build Next.js standalone (mode desktop) + copie des
// fichiers d'execution + compilation du processus principal Electron +
// copie des runtime Electron (electron-updater) + smoke test du serveur
// package (gate anti "Cannot find module").
// Fonctionne sur Windows, macOS et Linux.
import { spawnSync } from "node:child_process";

const buildEnv = {
  ...process.env,
  DESKTOP: "1",
  DESKTOP_BUILD: "1",
  NEXT_PUBLIC_DESKTOP: "1",
};

function run(label, args) {
  console.log(`\n[desktop:build] ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: buildEnv,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`[desktop:build] FAILED: ${label}`);
    process.exit(result.status ?? 1);
  }
}

run("next build (standalone, desktop)", ["node_modules/next/dist/bin/next", "build"]);
run("copy standalone runtime files", ["electron/build-standalone.mjs"]);
run("tsc electron", ["node_modules/typescript/bin/tsc", "-p", "tsconfig.electron.json"]);
run("copy electron runtime files", ["electron/build-electron.mjs"]);
run("smoke packaged server", ["electron/smoke-packaged.mjs"]);

console.log("\n[desktop:build] OK");

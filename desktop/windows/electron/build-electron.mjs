// electron/build-electron.mjs
//
// Copie electron-updater + ses dependances dans electron/dist/node_modules.
// L'app packagee ne contient ni node_modules racine ni store pnpm, et
// main.js (dans electron/dist) doit pouvoir require("electron-updater").
// (En dev, la resolution remonte vers node_modules du projet : rien a faire.)
//
// Inclut une auto-verification (check maintenu, joue en CI a chaque build) :
// electron-updater doit se resoudre DEPUIS electron/dist, sinon echec bruyant.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "electron", "dist");
const distModules = path.join(dist, "node_modules");

if (!existsSync(path.join(dist, "main.js"))) {
  throw new Error(
    "[build-electron] electron/dist/main.js introuvable (lancer `tsc -p tsconfig.electron.json` d'abord)"
  );
}

function findPkgDir(pkgName, parentDir) {
  const req = createRequire(path.join(parentDir, "package.json"));
  let dir;
  try {
    dir = path.dirname(req.resolve(pkgName));
  } catch (error) {
    throw new Error(
      `[build-electron] cannot resolve "${pkgName}" from ${parentDir}: ${error.message}`
    );
  }
  for (let i = 0; i < 6; i++) {
    const manifest = path.join(dir, "package.json");
    if (
      existsSync(manifest) &&
      JSON.parse(readFileSync(manifest, "utf8")).name === pkgName
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error(`[build-electron] package root not found for "${pkgName}"`);
}

const copiedPkgs = new Set();

function copyRuntimePkg(pkgName, parentDir) {
  const srcDir = findPkgDir(pkgName, parentDir);
  if (copiedPkgs.has(srcDir)) {
    return;
  }
  copiedPkgs.add(srcDir);
  const destDir = path.join(distModules, ...pkgName.split("/"));
  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(path.dirname(destDir), { recursive: true });
  // dereference : le layout pnpm est plein de symlinks, qui arriveraient
  // casses dans l'app packagee (meme piege que le standalone, cf.
  // build-standalone.mjs).
  cpSync(srcDir, destDir, { recursive: true, dereference: true });
  const srcVersion = JSON.parse(
    readFileSync(path.join(srcDir, "package.json"), "utf8")
  ).version;
  console.log(`[build-electron] copied: ${pkgName}@${srcVersion}`);
  const deps =
    JSON.parse(readFileSync(path.join(srcDir, "package.json"), "utf8"))
      .dependencies ?? {};
  for (const dep of Object.keys(deps)) {
    copyRuntimePkg(dep, srcDir);
  }
}

copyRuntimePkg("electron-updater", root);

// Auto-verification : la resolution depuis electron/dist doit aboutir DANS
// electron/dist/node_modules (pas un fallback vers le node_modules projet,
// absent de l'app packagee).
const distRequire = createRequire(path.join(dist, "main.js"));
const resolved = distRequire.resolve("electron-updater");
if (!resolved.startsWith(`${distModules}${path.sep}`)) {
  throw new Error(
    `[build-electron] electron-updater resolves outside dist: ${resolved}`
  );
}
console.log("[build-electron] self-check OK (resolves from electron/dist)");
console.log("[build-electron] OK");

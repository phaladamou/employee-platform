// electron/build-standalone.mjs
//
// Complete la sortie `output: standalone` de Next.js avec les fichiers
// charges a l'execution (non detectes par le traceur de fichiers) :
// - .next/static et public (requis documente du mode standalone)
// - migrations SQL drizzle (appliquees par PGlite au premier demarrage)
// - paquets runtime requires dynamiquement (pglite WASM, styled-jsx...)
// - dereferencement des symlinks pointant hors du standalone
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

function copyDir(src, dest, label) {
  if (!existsSync(src)) {
    throw new Error(`[build-standalone] missing: ${src}`);
  }
  // Le traceur Next peut laisser un symlink pnpm pendouillant : repartir
  // d'une cible propre (cpSync refuse d'ecraser un non-dossier).
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`[build-standalone] ${label}: ${src} -> ${dest}`);
}

if (!existsSync(path.join(standalone, "server.js"))) {
  throw new Error(
    "[build-standalone] .next/standalone/server.js introuvable (lancer `next build` avec DESKTOP_BUILD=1)"
  );
}

copyDir(
  path.join(root, ".next", "static"),
  path.join(standalone, ".next", "static"),
  "static"
);

const publicDir = path.join(root, "public");
if (existsSync(publicDir)) {
  copyDir(publicDir, path.join(standalone, "public"), "public");
}

copyDir(
  path.join(root, "lib", "db", "migrations"),
  path.join(standalone, "migrations"),
  "migrations"
);

// Paquets requis au runtime mais invisibles au traceur nft (require
// dynamique) : on les copie en dur depuis le store.
// - @electric-sql/pglite : binaires WASM charges via fs.
// - styled-jsx : next/dist/server/require-hook le resolve au BOOT
//   (sans lui : "Cannot find module 'styled-jsx/package.json'").
// - @swc/helpers : require par next/dist au BOOT (helpers interop SWC).
// - @next/env : require par next/dist au BOOT (chargement .env).
function findPkgDir(pkgName, parentDir) {
  const req = createRequire(path.join(parentDir, "package.json"));
  let dir;
  try {
    dir = path.dirname(req.resolve(pkgName));
  } catch (error) {
    throw new Error(
      `[build-standalone] cannot resolve runtime package "${pkgName}" from ${parentDir}: ${error.message}`
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
  throw new Error(
    `[build-standalone] package root not found for "${pkgName}"`
  );
}

const copiedPkgs = new Set();

function copyRuntimePkg(pkgName, parentDir) {
  const srcDir = findPkgDir(pkgName, parentDir);
  if (copiedPkgs.has(srcDir)) {
    return;
  }
  copiedPkgs.add(srcDir);
  const destDir = path.join(standalone, "node_modules", ...pkgName.split("/"));
  const srcVersion = JSON.parse(
    readFileSync(path.join(srcDir, "package.json"), "utf8")
  ).version;
  const destManifest = path.join(destDir, "package.json");
  if (
    existsSync(destManifest) &&
    JSON.parse(readFileSync(destManifest, "utf8")).version === srcVersion
  ) {
    console.log(`[build-standalone] runtime pkg already present: ${pkgName}@${srcVersion}`);
  } else {
    rmSync(destDir, { recursive: true, force: true });
    mkdirSync(path.dirname(destDir), { recursive: true });
    cpSync(srcDir, destDir, { recursive: true });
    console.log(`[build-standalone] runtime pkg copied: ${pkgName}@${srcVersion}`);
  }
  const deps =
    JSON.parse(readFileSync(path.join(srcDir, "package.json"), "utf8"))
      .dependencies ?? {};
  for (const dep of Object.keys(deps)) {
    copyRuntimePkg(dep, srcDir);
  }
}

copyRuntimePkg("@electric-sql/pglite", root);
const nextDir = findPkgDir("next", root);
copyRuntimePkg("styled-jsx", nextDir);
copyRuntimePkg("@swc/helpers", nextDir);
copyRuntimePkg("@next/env", nextDir);

// electron-builder copie les symlinks tels quels : un lien pointant hors du
// standalone (layout pnpm) arriverait casse dans l'installeur. On remplace
// chaque lien externe par une vraie copie ; un lien pendouillant = echec
// bruyant ici plutot qu'un .exe mort ("Cannot find module ...").
function dereferenceExternalLinks(dir, rootDir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const target = path.resolve(dir, readlinkSync(full));
      if (!existsSync(target)) {
        throw new Error(`[build-standalone] dangling symlink: ${full}`);
      }
      if (target !== rootDir && !target.startsWith(`${rootDir}${path.sep}`)) {
        rmSync(full, { force: true });
        cpSync(target, full, { recursive: true, dereference: true });
        console.log(`[build-standalone] dereferenced: ${full}`);
      }
    } else if (entry.isDirectory()) {
      dereferenceExternalLinks(full, rootDir);
    }
  }
}

dereferenceExternalLinks(
  path.join(standalone, "node_modules"),
  path.join(standalone, "node_modules")
);

console.log("[build-standalone] OK");

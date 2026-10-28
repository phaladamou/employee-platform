// electron/build-standalone.mjs
//
// Complete la sortie `output: standalone` de Next.js avec les fichiers
// charges a l'execution (non detectes par le traceur de fichiers) :
// - .next/static et public (requis documente du mode standalone)
// - migrations SQL drizzle (appliquees par PGlite au premier demarrage)
// - paquet @electric-sql/pglite complet (binaires WASM charges via fs)
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
} from "node:fs";
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

// node_modules peut etre un lien symbolique (pnpm) : resoudre le reel.
const pgliteSrc = realpathSync(
  path.join(root, "node_modules", "@electric-sql", "pglite")
);
copyDir(
  pgliteSrc,
  path.join(standalone, "node_modules", "@electric-sql", "pglite"),
  "pglite"
);

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

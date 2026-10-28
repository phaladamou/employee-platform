# AGENT_MEMORY.md — Handoff notes (Muse Code)

> Mémoire de travail du chantier **app Windows bureau**. Régénéré le 2026-10-28.
> Règle n°1 : la racine = l'app web de l'utilisateur. L'agent desktop ne touche
> qu'à `desktop/` + `/.github/workflows/desktop.yml` (seul fichier racine
> autorisé : GitHub n'exécute que les workflows racine).

## 0. Identité Git (ce dépôt)

Toujours committer/pousser au nom de `phaladamou <phaladrien@gmail.com>`
(config locale `.git/config` déjà fixée — ne pas utiliser l'identité globale).

## 1. Architecture mise en place (isolation desktop/web)

```
employee-platform/                  <- APP WEB (propriétaire: user, ne pas toucher)
├── .github/workflows/desktop.yml   <- SEULE exception racine : CI installeur.
│                                      Ne contient aucune logique (délègue tout
│                                      à desktop/windows via working-directory).
└── desktop/                        <- TOUT le bureau vit ici
    ├── README.md                   <- contrat d'isolation (lire en premier)
    ├── reference-web/              <- snapshot web FIGÉ, lecture seule (20 Mo)
    └── windows/                    <- CHANTIER : copie de travail + code desktop
```

Code desktop (dans `windows/` uniquement) :

- `electron/main.ts` — processus principal : génère `AUTH_SECRET`, alloue un
  port loopback, force `HOSTNAME=127.0.0.1`, charge le serveur standalone
  en-processus, attend `/api/models`, ouvre `/workspace`. Écrit
  `%APPDATA%/Employee/startup.log` + dialogue d'erreur Windows en cas d'échec.
- `electron/{dev,build,build-standalone}.mjs` — dev (Next+Electron),
  pipeline build, compléments standalone.
- `electron/smoke-packaged.mjs` — **gate anti-`MODULE_NOT_FOUND`** (voir §4).
- `lib/db/client.ts` — `getDb()` : Postgres en web, **PGlite embarquée**
  (`DESKTOP=1`, fichier local, migrations au 1er init, garde promise contre
  les inits concurrentes).
- `lib/desktop/settings.ts` + `app/(chat)/api/desktop/settings/route.ts` —
  clés API perso persistées localement (`settings.json`), lecture masquée.
- Auth bureau : credentials + guest uniquement (pas d'OAuth cloud).
- `lib/connectors/core/crypto.ts` — secrets dérivés du `authSecret` local
  en mode bureau (jamais d'env manquante au build).
- Migrations : `0000` + breakpoints `statement-breakpoint` (requis PGlite) ;
  `0003_desktop_missing_tables` (`bio`, `Document.chatId`, tables `File`,
  `connectors`, `notifications` — absentes des migrations historiques).
- `next.config.ts` (branches `DESKTOP_BUILD`) : `output: standalone`,
  `outputFileTracingRoot` local, `serverExternalPackages: [pglite]`
  (sinon webpack casse le WASM), `images.unoptimized` (pas de sharp natif),
  typecheck/lint désactivés dans le build (porte séparée `desktop:typecheck`),
  `cpus: 1` (mémoire).
- `electron-builder.yml` — NSIS `Employee-Setup-${version}.exe`, `npmRebuild:
  false` (zéro module natif au runtime : PGlite=WASM), `extraResources`
  explicites (voir §4, bug classique).

## 2. Commandes clés

Depuis `desktop/windows/` (pnpm **10.32.1**, imposé par `packageManager`) :

```sh
pnpm install --frozen-lockfile          # CI / install propre
pnpm desktop:typecheck                  # tsc web + tsc electron (0 erreur exigé)
pnpm desktop:build                      # next standalone + copies + tsc + SMOKE (gate)
pnpm desktop:dist                       # build + electron-builder --win (NSIS)
pnpm desktop:dev                        # dev local : Next desktop + Electron
```

Release (le build lourd passe par la CI, 16 Go, natif Windows) :

```sh
# 1. bump version dans desktop/windows/package.json (3.1.X)
git add <fichiers explicites> && git commit -m "fix(desktop): ..."
git push origin main
git tag -a desktop-v3.1.X -m "..." && git push origin desktop-v3.1.X
# 2. CI "Desktop (Windows)" build ~10 min -> Artifacts/Employee-Windows/*.exe
```

Suivi CI : `gh run list --repo phaladamou/employee-platform`,
`gh run view <id> --job <jobId> [--log|--log-failed]`
(si `~/.cache` est en lecture seule : `export XDG_CACHE_HOME=/tmp/xdg-cache`).

Inspection d'un installeur : télécharger l'artefact (`gh run download -n
Employee-Windows`), extraire le NSIS avec 7za (`7zip-bin` via npm),
vérifier `resources/standalone/node_modules/` et l'absence de symlinks
pendouillants (`find -L ... -type l`).

Tests Playwright bureau (MANUELS UNIQUEMENT, hors CI par décision user) :

```sh
DESKTOP=1 pnpm exec playwright test desktop-settings   # tests/e2e/desktop-settings.test.ts
```

## 3. Correctifs appliqués (historique)

- **v3.1.0** — 1er `.exe` via CI. Symptôme user : processus vivant, pas de
  fenêtre, silence total.
- **v3.1.1** — instrumentation boot (`startup.log`, dialogue d'erreur,
  `unhandledRejection`, `did-fail-load`). `HOSTNAME=127.0.0.1` vérifié déjà
  forcé (le template Next lit `process.env.HOSTNAME` au `require`).
  A révélé : `Cannot find module 'next'`.
- **v3.1.2** — cause : electron-builder **ignore silencieusement les dossiers
  `node_modules`** dans une copie `extraResources` globale (reproduit sur
  maquette minimale). Fix : entrée explicite
  `.next/standalone/node_modules -> standalone/node_modules` + passe de
  déréférencement des symlinks externes dans `build-standalone.mjs`.
  Vérifié dans l'installeur extrait. A révélé : `styled-jsx` manquant.
- **v3.1.3** — cause : le traceur Next (nft) ne voit pas les `require`
  dynamiques (`next/dist/server/require-hook` résout `styled-jsx` au BOOT).
  Fix : `copyRuntimePkg` récursif (résolution chaînée depuis le dépendant,
  compatible layout pnpm) : `styled-jsx`+`client-only`, `@electric-sql/pglite`
  unifié. + **gate `smoke-packaged`** : copie le standalone **hors projet**
  (sinon Node masque les manques via le `node_modules` parent !), boot réel,
  signin guest, crawl exhaustif des routes du manifeste (70), échec bruyant
  sur `MODULE_NOT_FOUND`. Le gate a attrapé `@swc/helpers` puis `@next/env`.
- **v3.1.4** — backfill `@swc/helpers` (+`tslib` via récursion).
- **v3.1.5** — backfill `@next/env`. **CI verte, smoke 70 routes, 0 échec.**
  Installeur vérifié : `next`, `styled-jsx`, `@swc/helpers`, `@next/env`
  présents, zéro symlink pendouillant.

Leçons dures :

1. `extraResources` + `node_modules` = entrée explicite obligatoire.
2. nft rate les requires dynamiques → la liste `copyRuntimePkg` est LE
   mécanisme (1 ligne par paquet manqué, détecté par le gate, jamais par
   l'utilisateur).
3. Tout smoke local du standalone DOIT tourner hors du projet (fallback
   `node_modules` parent = faux négatif).
4. pnpm 10.32.1 partout (lockfile) ; en sandbox, pnpm local + `--store-dir`
   sous /tmp, caches (`ELECTRON_CACHE`, `XDG_CACHE_HOME`) sous /tmp.
5. Next dev redémarre à 80 % du heap (`process.exit`) — prévoir
   `NODE_OPTIONS=--max-old-space-size=4096` pour `desktop:dev` si besoin.
6. Auth.js + bind `0.0.0.0` = redirects vers `http://0.0.0.0` → toujours
   binder `127.0.0.1` côté bureau.
7. `next build` complet ≈ 2,5 Go de pic mémoire ; en Codespace 8 Go partagé,
   tuerie SIGTERM (exit 143) = contention, pas bug → builder sur CI.

## 4. État actuel et à suivre

- **v3.1.5** (`.exe` 335 Mo compressé) : construit, vérifié, **en attente du
  retest Windows par l'utilisateur** (run CI 40677984217).
- `main` linéaire et à jour (rebase fait le 2026-10-28 ; les tags v3.1.3/4/5
  pointent vers les hash pré-rebase, contenu identique — normal).
- Si le retest révèle un nouveau `MODULE_NOT_FOUND` : ajouter le paquet dans
  `copyRuntimePkg` (résolution depuis son dépendant), bump version, tag →
  le gate CI valide avant tout retéléchargement.
- Non lié au bureau (pré-existant, côté web) : workflow `Lint` rouge ;
  laisser au user.
- Fichiers web non commités du user (14 M + `lib/db/client.ts`) : NE JAMAIS
  les inclure dans un commit desktop (pathspec explicites uniquement).

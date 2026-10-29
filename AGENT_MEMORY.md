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
│                                      à desktop/windows via working-directory,
│                                      + injecte le secret POSTGRES_URL,
│                                      + publie la Release GitHub).
└── desktop/                        <- TOUT le bureau vit ici
    ├── README.md                   <- contrat d'isolation (lire en premier)
    ├── reference-web/              <- snapshot web FIGÉ, lecture seule (20 Mo)
    └── windows/                    <- CHANTIER : copie de travail + code desktop
```

Bureau 100 % en ligne + auto-update (v3.2.1) : même Postgres distant que le web.

Code desktop (dans `windows/` uniquement) :

- `electron/main.ts` — processus principal : génère `AUTH_SECRET`, résout
  `POSTGRES_URL` (env puis `desktop-env.json` embarqué), alloue un
  port loopback, force `HOSTNAME=127.0.0.1`, charge le serveur standalone
  en-processus, attend `/api/models`, ouvre `/workspace`. Vérifie les
  mises à jour au démarrage (electron-updater, Releases GitHub). Écrit
  `%APPDATA%/Employee/startup.log` + dialogue d'erreur Windows en cas d'échec.
- `electron/{dev,build,build-standalone,build-electron}.mjs` — dev
  (Next+Electron), pipeline build, compléments standalone + `desktop-env.json`
  (secret CI, échec bruyant si absent), copie electron-updater dans
  `electron/dist/node_modules` (+ self-check de résolution).
- `electron/smoke-packaged.mjs` — **gate anti-`MODULE_NOT_FOUND`** : boot
  réel hors projet, vérifie `desktop-env.json`, signin credentials sur
  compte jetable (créé/supprimé en base), rampe des routes. Requiert
  `POSTGRES_URL` (voir §4).
- `lib/db/client.ts` — `getDb()` : **même Postgres distant qu'en web**
  (`POSTGRES_URL`, erreur claire si absent). Plus de base locale.
- `lib/desktop/settings.ts` + `app/(chat)/api/desktop/settings/route.ts` —
  clés API perso persistées localement (`settings.json`), lecture masquée.
- Auth bureau : credentials uniquement (pas d'OAuth cloud, plus de guest).
- `lib/connectors/core/crypto.ts` — secrets dérivés du `authSecret` local
  en mode bureau (jamais d'env manquante au build).
- Migrations : le bureau n'en applique plus au démarrage (base partagée,
  migrée côté web). `0003_desktop_missing_tables` conservé pour un
  `db:migrate` manuel si besoin.
- `next.config.ts` (branches `DESKTOP_BUILD`) : `output: standalone`,
  `outputFileTracingRoot` local, `images.unoptimized` (pas de sharp natif),
  typecheck/lint désactivés dans le build (porte séparée `desktop:typecheck`),
  `cpus: 1` (mémoire).
- `electron-builder.yml` — NSIS `Employee-Setup-${version}.exe`, `npmRebuild:
  false` (zéro module natif : postgres-js pur JS), `extraResources`
  explicites (voir §4, bug classique), `publish: github` (latest.yml
  pour l'auto-update).

## 2. Commandes clés

Depuis `desktop/windows/` (pnpm **10.32.1**, imposé par `packageManager`) :

```sh
pnpm install --frozen-lockfile          # CI / install propre
pnpm desktop:typecheck                  # tsc web + tsc electron (0 erreur exigé)
pnpm desktop:build                      # next standalone + copies + tsc + SMOKE (gate)
pnpm desktop:dist                       # build + electron-builder --win (NSIS)
pnpm desktop:dev                        # dev local : Next desktop + Electron
```

(`desktop:build`, `desktop:dist`, `desktop:dev` et le smoke requièrent
`POSTGRES_URL` : secret CI en build, `.env.local` en dev.)

Release (le build lourd passe par la CI, 16 Go, natif Windows) :

```sh
# 0. prérequis : secret Actions POSTGRES_URL sur le dépôt (Settings >
#    Secrets and variables > Actions). Le token Codespace ne peut pas
#    le créer (403) : action manuelle du user (fait le 2026-10-28).
# 1. bump version dans desktop/windows/package.json (3.2.X)
git add <fichiers explicites> && git commit -m "feat(desktop): ..."
git push origin main
git tag -a desktop-v3.2.X -m "..." && git push origin desktop-v3.2.X
# 2. CI "Desktop (Windows)" build ~10 min -> Artifacts/Employee-Windows/*.exe
#    + Release GitHub auto-publiée (exe + latest.yml, alimente l'auto-update).
#    Ne pas re-tagger sans supprimer la Release existante (gh release create
#    échoue si le tag a déjà une Release).
```

Suivi CI : `gh run list --repo phaladamou/employee-platform`,
`gh run view <id> --job <jobId> [--log|--log-failed]`
(si `~/.cache` est en lecture seule : `export XDG_CACHE_HOME=/tmp/xdg-cache`).

Inspection d'un installeur : télécharger l'artefact (`gh run download -n
Employee-Windows`), extraire le NSIS avec 7za (`7zip-bin` via npm,
`chmod +x` requis sur le binaire), vérifier `resources/standalone/`
(`desktop-env.json` renseigné, `node_modules/` présent) et
`resources/app-update.yml` (config updater), absence de symlinks
pendouillants (`find -L ... -type l`). Pour app.asar : `asar extract`
vers /tmp — JAMAIS `asar extract-file` depuis la racine (il écrase
package.json sur place, incident du 2026-10-28, restauré via git).

Tests Playwright bureau (MANUELS UNIQUEMENT, hors CI par décision user) :

```sh
DESKTOP=1 pnpm exec playwright test desktop-settings   # tests/e2e/desktop-settings.test.ts (+ POSTGRES_URL requis)
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
  signin credentials (compte jetable), crawl exhaustif des routes du
  manifeste (70), échec bruyant
  sur `MODULE_NOT_FOUND`. Le gate a attrapé `@swc/helpers` puis `@next/env`.
- **v3.1.4** — backfill `@swc/helpers` (+`tslib` via récursion).
- **v3.1.5** — backfill `@next/env`. **CI verte, smoke 70 routes, 0 échec.**
  Installeur vérifié : `next`, `styled-jsx`, `@swc/helpers`, `@next/env`
  présents, zéro symlink pendouillant. **Retest Windows user : OK.**
- **v3.2.0** — bureau 100 % en ligne : PGlite supprimé (dep, branche
  `getDb`, `serverExternalPackages`, copies runtime/migrations).
  `POSTGRES_URL` injecté par la CI (secret Actions) et embarqué dans
  `desktop-env.json` (`main.ts` le charge, override via env). Smoke CI
  requiert le secret (le compte jetable est créé puis supprimé par build,
  zéro ligne résiduelle). URL embarquée extractible du .exe : OK hackathon,
  rotation des clés prévue après par le user.
- **v3.2.1** — mises à jour auto (Windows NSIS) : `electron-updater` dans
  `main.ts` (vérif au démarrage, téléchargement en fond, install au
  redémarrage, logs `[updater]` dans startup.log), `publish: github`
  (latest.yml), CI publie la Release (exe + latest.yml, `contents: write`).
  `update-electron-app` écarté (exige Squirrel, incompatible NSIS).
  electron-updater copié dans `electron/dist/node_modules` par
  `build-electron.mjs` (+ self-check de résolution, joué en CI).
  Pas de téléchargement différentiel (.blockmap non publié : full ~300 Mo).
  Première Release = 3.2.1 (3.2.0 = artifact uniquement) : 1 install
  manuelle puis auto. E2E (téléchargement+install réels) non testé en
  CI — première preuve = la prochaine release après 3.2.1.
  Fix CI : `electron-builder --publish never` obligatoire (sinon, avec
  `publish: github`, il tente de publier lui-même et exige GH_TOKEN) ;
  la Release est publiée par l'étape `gh release create` du workflow.

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
8. Secret CI `POSTGRES_URL` obligatoire au build ; jamais de valeur en
   clair dans les logs ou le chat (longueurs/présence uniquement).
9. Sandbox Codespace : DNS/TCP direct bloqué (EAI_AGAIN vers Neon) — la
   connectivité DB ne se prouve qu'en CI (smoke).
10. Auto-update Windows NSIS = electron-updater + `publish: github`
    (update-electron-app exige Squirrel, incompatible). L'app packagee
    n'a pas de node_modules racine → toute dep du main process passe
    par `build-electron.mjs` (copie + self-check).

## 4. État actuel et à suivre

- **v3.2.1** : auto-update (cf. §3). **CI verte** (run 40711973512,
  smoke 70 routes 0 échec, self-check electron OK). Release GitHub
  `desktop-v3.2.1` publiée (exe 304 Mo + latest.yml vérifiés, app-update.yml
  + electron-updater vérifiés dans le NSIS extrait). **En attente du
  retest Windows par l'utilisateur** (installer 3.2.1 manuellement une
  fois, les suivantes seront automatiques).
- `main` linéaire et à jour.
- Si le retest révèle un nouveau `MODULE_NOT_FOUND` : ajouter le paquet dans
  `copyRuntimePkg` (résolution depuis son dépendant), bump version, tag →
  le gate CI valide avant tout retéléchargement.
- Si une route 500 faute de table manquante côté distant : appliquer
  `0003` via `db:migrate` manuel (user, depuis une machine avec accès DB).
- Non lié au bureau (pré-existant, côté web) : workflow `Lint` rouge ;
  laisser au user.
- Fichiers web non commités du user (14 M + `lib/db/client.ts`) : NE JAMAIS
  les inclure dans un commit desktop (pathspec explicites uniquement).

# AGENT_MEMORY.md — Handoff notes (Muse Code)

> Mémoire de travail PARTAGÉE (commitée, poussée) : bureau Windows (§1-4),
> web (§5-7), EmployeeCore (§8), conventions (§9). Régénéré le 2026-10-31.
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

## 5. Web : design Mercor light + Talent Network (2026-10-30)

- Pages `Employees` + `Talent Network` en thème CLAIR (scope `.theme-light`,
  sidebar blanche/grise), chat seul reste sombre. Grille 3 cartes/ligne,
  max-w-7xl, paddings et espacements généreux, scrollbar masquée
  (`.scrollbar-none`, scroll conservé).
- Boutons `Recruit` discrets (variante `brand` indigo), jamais de gros noir.
- Recruit = page dédiée `/employees/recruit` + entrée sidebar dans le footer
  (au-dessus du compte, centrée en mode icône). Bannir « marketplace »
  (dire Talent Network / Réseau). Pas d'étoiles ni gadgets freelance.
- Split-view inline : colonne liste (~62 %) + panneau détails (38 %) qui
  commence tout en haut, jamais un tiroir qui écrase le contenu.
- `AI Employees` inactif sur `/employees/recruit` (helper
  `lib/sidebar/nav-state.ts` + test). Sidebar fermée : `SIDEBAR_WIDTH_ICON`
  4rem, logo + items + footer centrés.
- Fichiers : `app/(chat)/employees/`, `components/workspace/employees/`,
  `components/workspace/recruit/`, `lib/employees/catalog.ts` (+test),
  `app/globals.css` (`.theme-light`, `.scrollbar-none`).

## 6. Web : auth OTP + onboarding passwordless (2026-10-30)

- Login/signup 100 % passwordless : OTP 7 chiffres par email (Resend,
  `RESEND_API_KEY`), 5 min, usage unique, throttle NextAuth. Zéro invité :
  non connecté → `/login`. `/register` redirige vers `/login`.
- 1er OTP valide = création compte → `/onboarding` (nom, titre, intention
  solo/startup/enterprise, société, CGU) → `onboarded=true` → `/workspace`
  (migration `0005_user_onboarding` : `onboarded/title/intent/company`).
- Gardes : middleware (`lib/auth/route-policy.ts` + test, `/onboarding`
  protégé), page onboarding serveur (sans session →
  `/login?callbackUrl=/onboarding`, onboardé → `/workspace`), layout `(chat)`
  (non-onboardé → `/onboarding`), `POST /api/onboarding` → 401 sans session.
- **Piège :** la route onboarding DOIT rester à `app/api/...` (racine). Sous
  `app/(chat)/api`, le layout `(chat)` redirige le POST lui-même →
  « Connection lost ». Test : `app/api/onboarding/route.test.ts`.
- Email OTP premium 100 % anglais, code noir, vrai logo inline (CID),
  sans ligne disclaimer (`lib/otp-email-template.ts` + test, PNG dans
  `public/images/employee-logo.png`).
- Logout sans friction : `signOut({ callbackUrl: "/login" })` +
  `window.location.replace`, aucun toast, aucun blocage.
- Logs diagnostics `[AUTHORIZE-OTP]` / `[AUTH-JWT]` / `[AUTH-SESSION]` dans
  `app/(auth)/auth.ts` (email reçu → verdict → user retourné).
- Incident « même compte quel que soit l'email » : audit complet du pipeline
  OTP propre (chaque étape filtre par email) ; cause probable = session /
  cookie stale dans le navigateur de test. Trancher via les logs + test en
  navigation privée avant toute autre hypothèse.
- Brouillon du champ chat scopé par compte (`lib/chat-draft.ts` + test,
  `use-draft-input.ts`) : clé `input:<userId>`, jamais la clé globale
  `input` (partagée entre comptes, nettoyée au montage). Câblé dans
  `multimodal-input.tsx` et `multimodal-input-websites.tsx`.

## 7. Web : session sidebar « sticky » (2026-10-30)

- Coupure serveur/réseau ≠ logout : l'icône compte et l'historique gardent
  le dernier état connu (`lib/auth/sticky-session.ts` pur + test,
  `components/workspace/use-sticky-session.ts`, `keepPreviousData` SWR).
- Seul un **200 + session vide** prouve le logout (le proxy codespace
  renvoie 503/HTML quand `pnpm dev` est coupé — ne jamais traiter non-200
  comme logout ; cf. `classifySessionProbe`). Référence en mémoire module
  + `localStorage["employee:last-known-user"]`.
- Purge via `clearStickyUser()` AVANT `signOut`. Changement de compte et
  logout cross-onglet suivent toujours le live (sonde de confirmation).
- Footer fermé aligné connecté OU non (bouton login icon-mode centré +
  tooltip, même pattern que Recruit).

## 8. EmployeeCore — `core/employee/` uniquement (2026-10-30)

- Noyau pur TypeScript, testable sans l'app : `identity/` (ID crypto),
  `profile/` (types), `missions/` (modèle + assignation), `memory/`
  (file store + quarantaine + injection d'expérience), `runtime/` (boucle
  ReAct `ACTION:`/`FINAL:`, moteur LLM), `tools/` sandboxés (read/write/
  run-shell), `cli.ts`, `index.ts`, `purity.test.ts`.
- **Contraintes dures :** travailler UNIQUEMENT dans `core/employee/`,
  ne jamais toucher au reste de `core/` ; aucun import React/Next/Electron ;
  env uniquement via CLI injectée ; suite vitest verte (79 tests).
- Sécurité auditee : symlinks bloqués, env enfant filtré (`run_shell`
  cwd-confined, pas une jail — commentaire honnête conservé). Concurrence
  last-wins et TOCTOU documentés, non bloquants.
- LLM via `EMPLOYEE_PROVIDER` : `deepseek` (défaut, `DEEPSEEK_API_KEY`) ou
  `muse` (Meta, `MUSE_API_KEY` dev.meta.ai, base `https://api.meta.ai/v1`,
  modèle `muse-spark-1.3` — API compatible OpenAI donc même provider
  `FetchLLMProvider`). **Muse validé par appel réel le 2026-10-30**
  (mission hello.txt : completed, 9 steps, write+read OK). Pas d'Anthropic.
- Lancer le CLI sans `tsx` (EPERM sandbox) : copie vers `.tmp/` avec
  extensions `.ts` ajoutées aux imports relatifs, puis
  `node --experimental-transform-types` (nettoyer `.tmp` après).
- Phase 1 auth : `core/employee/auth/` — identité permanente `emp_...`,
  clés `emk_...` révocables (hash SHA-256 stocké, jamais le clair),
  `issueCredential`/`verifyCredential` purs, port
  `EmployeeCredentialStore`, backend `FileCredentialStore`
  (`credentials.json`, quarantaine, échec fermé). Durci : tokens 32
  octets aléatoires, fichier chmod 600.
- Phase 2 profils : `core/employee/profiles/` — spec versionnee
  (name/version/role/prompt/outils/permissions/maxSteps), registre JSON
  (data-analyst, researcher sans shell, software-engineer), enforcement
  fail-fast par le runtime (`resolveToolsForProfile`, outil sans
  permission = erreur avant le 1er appel LLM).
- Invariant ADN : `specialization {name, version exacte}` liee a
  l'embauche (immuable), `run()` resout via registre (jamais latest,
  `tools` ignores si lie, maxSteps restreint seulement), migration
  explicite `migrateEmployeeProfile` (nouvel objet, meme id), prompt
  spec delimite + ligne de preseance.
- Registre : `profiles.lock.json` (SHA-256 contenu canonique), verifie
  au chargement (strict defaut, `trust.lockfilePath` separable,
  `verify:false` dev only), `createProfileLockfile` cote Createur,
  README trust model. Signatures Ed25519 reservees phase 3.
- Phase 3 B1 : cles employeurs `emo_` + store fichier (chmod 600),
  scopes employments:read/write, relation Employment (`hire_` :
  hire idempotent, terminate sans destruction) + file store.
  156 tests vitest.
- Phase 3 B2 : memoire scopee `(employeeId, employerId)` — missions et
  records tagues (legacy `null` lisible partout, documente), store
  `employee_<id>/employer_<e>.json` + fallback legacy, injection LLM
  filtree par scope (test cross-employer). 162 tests.
- Phase 3 B3 : jobs `job_` + `FileJobStore` (claim atomique via `.lock`
  `wx`, vol des verrous stale 60s, quarantaine), annulation cooperative
  en deux temps (`cancellation_requested` -> `cancelled`, flag
  `cancelled` distinct de `failed` dans boucle/runtime). 192 tests.
- Phase 3 B4 : stores profils/missions + SDK scinde (`EmployeeClient`
  lie au tenant, `EmployeeCreator` admin, in-process + HTTP/SSE avec
  re-assemblage des chunks), `runJobOnce`/`runClaimedJob` partages,
  contrat REST `sdk/rest-contract.ts`. 225 tests.
- Phase 3 B5 : serveur REST pur + auth `emo_` + scopes (401 uniforme,
  404 scope indistinguable, SSE avec heartbeat, 413 > 1 Mo),
  adaptateur node:http, boucle worker (`claimNext` tous tenants,
  arret gracieux). Tests HTTP reels (bypass proxy loopback via
  no_proxy), garde purete restreinte au code livre. 238 tests.
- Phase 3 B6 : CLI `serve/publish/hire/submit/status/cancel/events/
  keys/run` (commands testables, `cli.ts` = env -> ctx, prompt nu
  legacy), E2E maintenu `cli/e2e.test.ts` (cles -> publish lie ->
  hire -> submit -> worker -> events -> revocation), README noyau.
  Binaire via `.tmp/` + réécriture `.ts` + transform-types.
- Live Muse (api.meta.ai muse-spark-1.3) : E2E reel vert (publish lie
  -> hire -> submit -> succeeded ~15s, rapport grounded, hello.txt
  verifie). Correctif requis : parseur ReAct tolerant (Muse prepose
  du bavardage ; premiere directive gagne + extraction JSON equilibree,
  contenu toujours strict). 251 tests.
- Garantie 2 (recovery) : bail par heartbeat (`lastHeartbeatAt`, 15 s,
  best-effort) + `recoverStaleJobs` (running stale -> queued avec trace,
  cancellation_requested stale -> cancelled), sweep au demarrage du
  worker + CLI `recover`. Legacy sans battement : repli sur startedAt.
- Garantie 3 (CV verifiable) : `missions/mission-proof.ts` — SHA-256 du
  rapport stocke en memoire (`reportHash`, null si echec/legacy),
  `generateMissionProof` (certificat Ed25519 operateur, sans contenu
  confidentiel), `verifyMissionProof` (+ pinning emetteur optionnel),
  `verifyReportDisclosure` (divulgation selective). 272 tests.
- Audit adversarial garanties 2+3 : failles reelles corrigees — sweep
  recovery sur tours idle (orphelins d'un pair crashé APRES demarrage,
  sinon bloques jusqu'au restart), garde anti-seuil negatif CLI.
  Assume/documente : rejeu integral at-least-once (double side effects
  possibles, journal d'idempotence propose non implemente), pas de
  revocation preuves (rotation totale ou rien, keyId/CRL proposes).
  Theoriques : double-hold verrou (fenetre µs), wx sur NFS.
  280 tests (courses N-way, rotation, pinning, rejeu epingle).
- Batterie adversarial CLI `cli/adversarial.test.ts` (T1-T4 E2E) :
  mutation profil refusee (404 + ADN inchange), isolation alpha/beta
  (CLI+HTTP+memoire), researcher sans shell (preuve disque), preuves
  forgees rejetees sur run reel. Piege : flip base64url JAMAIS en
  dernier caractere (bits de padding ignores). 284 tests.
- Semantique succes (faille ChatGPT : Final auto-declare) : criteres
  d'acceptation declares verifies disque (non satisfaits -> failed),
  etat terminal `needs_review` (moyens hors profil + zero appels
  reussis, rapport preserve, zero preuve), sinon confiance inchangee.
  T3a/b/c E2E. Test heartbeat rendu deterministe (attente observee,
  plus de sleep fixe). 307 tests.
- Heuristiques claims/refus (T5a/b/c + audit 4 points) : Final qui
  affirme des effets sans appel supportant -> `needs_review`
  (`missions/mission-claims.ts`, FR+EN, `(?![\p{L}])` + flag `u`,
  apostrophes `['’]?`, exclusion agents tiers) ; refus honnetes
  avoues -> `needs_review` aussi (jamais `failed` auto). 4 declen-
  cheurs `needs_review` documentes (ERROR_HANDLING.md). Limite :
  faux negatifs par reformulation, jamais faux echecs. 349 tests.
- Couche Rust (crate `employee-native`, zero deps sauf ed25519/serde/
  libc/rand) : `crypto.rs` (Ed25519, WASM + natif), `sandbox.rs`
  (timeouts, plafonds sortie, rlimits Unix, kill groupe via setpgid),
  binaire `emp-sandbox` (protocole JSON, exit 2 = erreur sandbox),
  pont `run_shell` (repli Node silencieux sur ENOENT uniquement,
  fail-closed sinon). WASM sans wasm-bindgen (`wasm_api.rs` + wrapper
  TS sync/async, `new WebAssembly.Module`, seed hote pour keygen).
  `.wasm` COMMITÉ (`core/employee/wasm/dist/`, tests sans toolchain).
  `build.sh` = `--lib` uniquement (le binaire natif ne compile pas en
  wasm32 — casse depuis son introduction, fixée).
- Docker + Cosign : image multi-stage (node:22-slim + rust:1-bookworm),
  `emp-sandbox` inclus, user node, root FS read-only, volumes `/data
  /sandbox /workspaces`, `CMD serve --port 8000 --host 0.0.0.0`.
  Transform `.ts` rejouée localement (Usage + `keys issue` + grep
  imports, zéro restant). `docker build` jamais exécuté ici (pas de
  daemon — dit honnêtement, précédent ADR-011). Cosign keyless sur
  les installeurs desktop (`.sig` + `.pem`, vérifiés en CI).
- E2E live réel + 3 gaps corrigés (rapport honnête livré) ; `PORT`
  cloud (`--port` > `PORT` > 8000, erreur paresseuse) ; faisceau
  `EmployeeStores` + stub `openPostgresStores` (fichier par défaut,
  Postgres à implémenter) ; pas de `vercel.json` (Next standard).
- Workspaces par employé (ADR-014) : `EMPLOYEE_WORKSPACES_DIR`
  (défaut `.data/workspaces/`), `<employeeId>/`, `ToolContext.-
  workspaceRoot` + `toolRoot()` SEUL point de décision (outils +
  `mkdir` boucle + vérification acceptance — T3c a attrapé le
  contournement : fichier créé mais « missing »), `acquire` idem-
  potent au hire/démarrage job (repli sandbox bruyant si échec),
  `archive` au terminate (jamais de suppression). Évasion =
  `path escapes the workspace`. T3c vit dans le workspace,
  `sandbox/` n'est plus créé quand le workspace est posé.
- Confinement Landlock `run_shell` (ADR-015) : `rust/src/-
  fs_confinement.rs`, politique côté fils (`pre_exec`, zéro alloc —
  confiner le parent cassait `/dev/null`/stdin), workspace RW +
  `/bin /sbin /usr /lib /lib64 /etc` RO, tout le reste refusé à
  chaque accès (pas de TOCTOU) ; `TMPDIR` dans le workspace ;
  fail-closed (pas de Landlock ou ABI > v4 = refus exit 2).
  Filtrage `..` en chaîne REFUSÉ (théâtre + faux positifs).
  Sans `EMPLOYEE_SANDBOX_BIN` : repli Node `cwd`-only, SANS
  confinement FS (doc OPERATIONS §8, binaire requis en prod).
- Race heartbeat-vs-finish : `acquireLock` single-attempt flakait
  ~50 % sous charge → retry borné 20×5 ms (vol stale inchangé) +
  test 10 battements same-tick (red-green). Ne pas régresser.
- Docs pro EN : TESTING (suites + T1-T5 + couverture honnête),
  DECISIONS (ADR-001→015), ERROR_HANDLING, OPERATIONS (§3 backup
  workspaces/archive, §7 Docker, §8 strict backend), ROADMAP,
  ARCHITECTURE, READMEs (`core/employee` en FR, `rust/` en EN).
- **État 2026-10-31 : code @ 59aed5f — 371 tests Vitest (46 fichiers)
  + 27 cargo (17 lib + 3 bin + 7 Landlock), `tsc` propre, WASM OK.**
  (Convention : cette ligne suit le dernier commit de CODE ; les
  commits mémoire seuls ne la font pas bouger.)
- Résiduels assumés : workspaces par employé pas par employeur
  (durcissement `<employerId>/` = 3 lignes, documenté), TOCTOU
  outils fichiers accepté (supervisé local, pas multi-tenant
  hostile), pas d'isolation réseau (TCP V4 inutilisé), node-in-
  shell non testé sous Landlock, `.data/` scratch non-tracké.

## 9. Conventions et environnement (rappel)

- Micro-commits par petits blocs (`feat(web):` / `fix(web):` / `test(web):`),
  push et tags uniquement sur approbation explicite. Ne jamais `localhost:3000`
  en dur ; jamais de tests E2E locaux lourds (Codespace sans réseau/DB).
- `tsc --noEmit` zéro erreur exigé (mesurer le vrai exit code, pas celui du
  pipe). Suites `node:test` : catalog, nav-state, otp-email-template,
  route-policy, sticky-session, placement onboarding. Chaque `*.test.ts`
  ajouté à `exclude` dans `tsconfig.json`.
- `pnpm dev` = web Next (`next dev --turbo`). Desktop = miroirs manuels
  web → `desktop/windows` UNIQUEMENT sur demande ; releases via bump +
  tag `desktop-vX` + CI (v3.4.0 verte : exe + latest.yml).
- `.data/` = scratch employee-core, non commité. `SignOutForm` inutilisé
  (logout réel dans `sidebar-user-nav`). User teste sur l'URL codespace
  `*.app.github.dev`. Ne pas éditer pendant ses tests.
- EmployeeCore : gates `tsc` + `vitest run` + `cargo test --locked`
  avant tout push ; tests obligatoires par fix (red-green, plus petit
  test ciblé) ; micro-commits en tant que `phaladamou`, push sur main
  à la fin de chaque bloc ; CLI sans `tsx` (copie `.tmp/` + rewrite
  `.ts` + `node --experimental-transform-types`) ; rester dans le
  dossier assigné, pas de run-ahead ; français en chat, docs EN.
- Toolchain Rust : `$HOME` read-only → `CARGO_HOME`/`RUSTUP_HOME`
  dans `/tmp/emp-rust`, **effacé entre sessions** (réinstaller avec
  `rustup.sh --no-modify-path` puis `rustup default stable`).
- Tests confinement : binaire debug requis (`cargo build`) + noyau
  Landlock ; skip BRUYANT (`SKIP …`) sinon, jamais silencieux.
- Ce fichier EST la mémoire partagée : chaque bloc terminé l'actualise
  (état + comptes de tests + commit main), puis commit + push.
- Deux mémoires distinctes, ne pas confondre : `MEMORY.md` privé de
  l'agent (`~/.local/share/muse/memory/...`, hors repo, JAMAIS poussé,
  meurt avec la machine) vs ce `AGENT_MEMORY.md` (dans le repo,
  commité/poussé, lui seul fait foi pour les handoffs).

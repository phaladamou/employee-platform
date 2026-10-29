# windows/ — Chantier application bureau (Windows/Electron)

Copie de travail complète du projet + code desktop. L'agent desktop travaille ici.
Le bureau est 100 % en ligne : même base Postgres distante que le web (`POSTGRES_URL`),
aucune base locale. Une simple fenêtre Electron sur l'application partagée.

## Code desktop présent ici (et nulle part ailleurs)

- `electron/` — processus principal, preload, scripts `dev.mjs` / `build.mjs` / `build-standalone.mjs`
- `electron-builder.yml`, `tsconfig.electron.json`
- `lib/desktop/settings.ts` — réglages locaux (`settings.json` : clés LLM, secret d'auth)
- `lib/db/client.ts` — même Postgres distant que le web (`POSTGRES_URL` requis)
- `lib/connectors/core/crypto.ts` — secrets dérivés du `authSecret` local en mode bureau
- `types/desktop.d.ts`
- `app/(chat)/api/desktop/settings/route.ts` — API des réglages
- `app/(chat)/settings/engine/desktop-api-key-card.tsx` + branche dans `engine-form.tsx`
- Branches `NEXT_PUBLIC_DESKTOP` dans `app/(auth)/login`, `app/(auth)/register`, `app/(auth)/auth.ts`
- `output: standalone` conditionnel (`DESKTOP_BUILD=1`), `outputFileTracingRoot` local dans `next.config.ts`
- `electron/build-standalone.mjs` — embarque `desktop-env.json` (URL Postgres fournie par la CI) + backfills `styled-jsx`/`@swc/helpers`/`@next/env`
- `electron/smoke-packaged.mjs` — gate CI : boot réel du standalone + signin credentials (compte jetable créé/supprimé) + rampe des routes (requiert `POSTGRES_URL`)
- `electron/test-user.mjs` — helper partagé des tests : crée/supprime le compte jetable (+ ses chats/messages)
- Mise à jour auto : `electron-updater` dans `main.ts` (vérif au démarrage, téléchargement en fond, installation au redémarrage) + `publish: github` dans `electron-builder.yml` ; CI publie `latest.yml` sur la Release (`electron/dist/node_modules` assemblé par `build-electron.mjs`)
- `lib/db/migrations/0003_desktop_missing_tables.sql` — tables/colonnes du schéma absentes des migrations historiques (utile pour un `db:migrate` manuel ; le bureau n'applique plus de migrations au démarrage)
- Breakpoints `--> statement-breakpoint` dans `0000_initial.sql` (requis par le migrateur drizzle)
- Clés `desktopApi*` dans `messages/*.json`
- `tests/e2e/desktop-settings.test.ts` — tests API du mode bureau (`DESKTOP=1` + `POSTGRES_URL`, manuel uniquement)
- CI installeur Windows : `/.github/workflows/desktop.yml` à la racine (seul emplacement exécuté par GitHub ; délègue à `desktop/windows`, injecte le secret `POSTGRES_URL`)
- Deps `package.json` : `electron`, `electron-builder`, `electron-updater`,
  scripts `desktop:dev`, `desktop:build`, `desktop:dist`, `desktop:typecheck`

## État validé au 28/10/2026 (v3.2.0, bureau en ligne)

- `pnpm desktop:typecheck` : 0 erreur (web + electron).
- Serveur en `DESKTOP=1` : gate 401, provider credentials uniquement,
  connexion sur compte jetable (nettoyé après test), settings GET/POST/masquage, validation 400.
- `pnpm desktop:build` : build standalone + config runtime embarquée + copies runtime + tsc electron + smoke OK.
- `pnpm desktop:dist` : installeur Windows NSIS (`release/Employee-Setup-*.exe`).
- `.env.local` volontairement absent (secrets). Dev bureau : créer `.env.local`
  avec `POSTGRES_URL` (+ clés LLM via les réglages de l'app).

## Commandes (depuis ce dossier)

```sh
pnpm install
pnpm desktop:typecheck                      # typecheck web + electron
DESKTOP=1 pnpm exec playwright test desktop-settings   # tests API bureau (POSTGRES_URL requis)
pnpm desktop:dev                            # dev : Next.js (desktop) + Electron (POSTGRES_URL requis)
pnpm desktop:build                          # build standalone + electron/dist (POSTGRES_URL requis)
pnpm desktop:dist                           # + installeur Windows (NSIS)
```

## Environnement contraint (mémoire < 8 Go)

Le `next build` complet + typecheck intégré peut dépasser la mémoire disponible
(processus tué, exit 143). Le build bureau désactive le typecheck/lint intégrés
de Next (porte séparée `desktop:typecheck`) et limite les workers (`cpus: 1`).
En cas d'échec inexpliqué, relancer sur un dossier `.next` propre (`rm -rf .next`).

## Icône de l'installeur (à faire)

Aucun logo carré utilisable dans le projet (que des captures d'écran).
Pour une icône personnalisée : ajouter `electron/icon.ico` (256x256) et
`win.icon: electron/icon.ico` dans `electron-builder.yml`.

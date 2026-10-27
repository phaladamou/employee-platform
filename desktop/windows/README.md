# windows/ — Chantier application bureau (Windows/Electron)

Copie de travail complète du projet + code desktop. L'agent desktop travaille ici.

## Code desktop présent ici (et nulle part ailleurs)

- `electron/` — processus principal, preload, scripts `dev.mjs` / `build.mjs` / `build-standalone.mjs`
- `electron-builder.yml`, `tsconfig.electron.json`
- `lib/desktop/settings.ts` — réglages locaux (`settings.json`)
- `lib/db/client.ts` — variante PGlite embarquée (`DESKTOP=1`)
- `lib/connectors/core/crypto.ts` — secrets dérivés du `authSecret` local en mode bureau
- `types/desktop.d.ts`
- `app/(chat)/api/desktop/settings/route.ts` — API des réglages
- `app/(chat)/settings/engine/desktop-api-key-card.tsx` + branche dans `engine-form.tsx`
- Branches `NEXT_PUBLIC_DESKTOP` dans `app/(auth)/login`, `app/(auth)/register`, `app/(auth)/auth.ts`
- `output: standalone` conditionnel (`DESKTOP_BUILD=1`), `serverExternalPackages` PGlite,
  `outputFileTracingRoot` local dans `next.config.ts`
- `lib/db/migrations/0003_desktop_missing_tables.sql` — tables/colonnes du schéma
  absentes des migrations historiques (requis pour une base bureau fraîche)
- Breakpoints `--> statement-breakpoint` dans `0000_initial.sql` (requis par PGlite)
- Clés `desktopApi*` dans `messages/*.json`
- `tests/e2e/desktop-settings.test.ts` — tests API du mode bureau (`DESKTOP=1`, manuel uniquement)
- CI installeur Windows : `/.github/workflows/desktop.yml` à la racine (seul emplacement exécuté par GitHub ; délègue à `desktop/windows`)
- Deps `package.json` : `@electric-sql/pglite`, `electron`, `electron-builder`,
  scripts `desktop:dev`, `desktop:build`, `desktop:dist`, `desktop:typecheck`

## État validé au 27/10/2026

- `pnpm desktop:typecheck` : 0 erreur (web + electron).
- PGlite : 13/13 tables créées et lisibles sur base vierge, migrations idempotentes.
- Serveur en `DESKTOP=1` : gate 401, providers credentials+guest uniquement,
  connexion guest (écriture PGlite réelle), settings GET/POST/masquage, validation 400.
- `pnpm desktop:build` : build standalone + copies runtime + tsc electron OK.
- `pnpm desktop:dist` : installeur Windows NSIS (`release/Employee-Setup-*.exe`).
- `.env.local` volontairement absent (secrets). Clés de test via les réglages de l'app.

## Commandes (depuis ce dossier)

```sh
pnpm install
pnpm desktop:typecheck                      # typecheck web + electron
DESKTOP=1 pnpm exec playwright test desktop-settings   # tests API bureau
pnpm desktop:dev                            # dev : Next.js (desktop) + Electron
pnpm desktop:build                          # build standalone + electron/dist
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

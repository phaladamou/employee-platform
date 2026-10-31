# EmployeeCore — infrastructure de travailleurs async

Noyau pur (TypeScript, zero dependance hors Node + `dotenv` pour la CLI) :
identites, profils versionnes, missions, memoire scopee, jobs async,
SDK Createur/Client, serveur REST et CLI. Aucun import React/Next/Electron
(garde `purity.test.ts`), `process.env` lu uniquement dans `cli.ts`.

## Demarrage rapide

```bash
# 1. Preparer une copie executable (.ts directs, sans tsx)
rm -rf .tmp/emp && mkdir -p .tmp/emp && cp -r core/employee/* .tmp/emp/
cd .tmp/emp && find . -name "*.ts" \
  -exec perl -pi -e 's/from "(\.\.?\/[^"]+?)(?<!\.ts)"/from "$1.ts"/g' {} +
alias emp="node --experimental-transform-types --no-warnings cli.ts"

# 2. Cles (stockees hashees, chmod 600, dans $EMPLOYEE_DATA/credentials)
export EMPLOYEE_DATA=/var/lib/employee
emp keys issue --employer ops --admin --label root      # -> token emo_...
emp keys issue --employer acme --label prod             # -> token emo_...

# 3. Serveur API + worker (profil lockfile verifie au boot)
export DEEPSEEK_API_KEY=...        # ou EMPLOYEE_PROVIDER=muse + MUSE_API_KEY
emp serve --port 8000

# 4. Publier (admin), recruter, soumettre (employeur)
export EMPLOYEE_TOKEN=<emo_admin> EMPLOYEE_API_URL=http://127.0.0.1:8000
emp publish --name Aria --role "Data Analyst" --spec data-analyst@1.0.0
export EMPLOYEE_TOKEN=<emo_acme>
emp hire emp_xxx
emp submit emp_xxx "Audit churn"
emp status job_xxx
emp events job_xxx        # SSE jusqu'a l'etat terminal
emp cancel job_xxx
emp recover   # re-file les jobs orphelins d'un crash worker
```

Demo locale sans serveur : `emp run "Relis briefing.txt et resume-le"`.

## Semantiques validees (ne pas degrader)

- **Publish vs hire** : le Createur publie des employes et pose leur ADN
  (`specialization: nom@version` exacte, resolue via le registre au run) ;
  l'employeur recrute un employe publie, il ne definit jamais l'ADN.
- **File at-least-once** : `claim` atomique (fichier verrou `wx`) — un seul
  worker gagne ; un worker mort en `running` laisse le job verrouille
  (bail par heartbeat : `recoverStaleJobs` re-file les orphelins,
  annulations orphelines soldees en `cancelled`).
- **Annulation en deux temps** : `queued -> cancelled` immediat ;
  `running -> cancellation_requested`, le worker s'interrompt au prochain
  pas LLM puis confirme (`cancelled`). Distinguer de `failed`.
- **Succes verifie, jamais auto-declare** : criteres d'acceptation
  declares (`--expect-file`, `--expect-contains`) controles sur disque
  (echec -> `failed`) ; sans criteres, moyens hors profil tentes sans
  rien accomplir -> `needs_review` (rapport preserve, pas de preuve).
- **Isolation tenants** : `employerId` derive du token verifie, jamais du
  body/URL ; lectures scopees (`loadScoped`) indistinguables (404 unique,
  pas de fuite d'existence) ; memoire partitionnee par
  `(employeeId, employerId)` et rappelee au LLM uniquement dans ce scope.
- **Profils verrouilles** : `profiles.lock.json` (SHA-256) verifie au
  chargement ; spec absente/modifiee = refus franc. `verify: false`
  reserve au dev, jamais en prod.

## REST (`/v1`, `Authorization: Bearer emo_...`)

| Route | Scope | Succes |
|---|---|---|
| `POST /hires {employeeId}` | `employments:write` | 201 (idempotent) |
| `GET /hires` | `employments:read` | 200 |
| `POST /jobs {employeeId, prompt}` | `missions:submit` | 202 (403 si non recrute) |
| `GET /jobs?status=a,b` | `missions:read` | 200 |
| `GET /jobs/:id` | `missions:read` | 200 / 404 scope |
| `POST /jobs/:id/cancel` | `missions:submit` | 200 / 404 scope |
| `GET /jobs/:id/events` | `missions:read` | SSE `data: {job}` + `: ping` |
| `GET /missions/:id` | `missions:read` | 200 / 404 scope |
| `GET /employees` | `missions:read` | 200 (catalogue) |
| `POST /employees` | `admin` | 201 |

Erreurs : `{error, message}`, 401 uniforme (token absent/invalide/expire/
revoque/hors scope — pas d'oracle), 413 corps > 1 Mo.

## Layout

```
core/employee/
  identity/       empreinte emp_...
  auth/           cles employeur emo_ (hashes, scopes, TTL, revocation)
  profile/        profils + FileProfileStore
  profiles/       specs versionnees + lockfile + registre verifie
  employments/    engagements hire_ (relation separee)
  missions/       missions + FileMissionStore
  memory/         memoire scopee (employee, employer) + FileMemoryStore
  jobs/           jobs + FileJobStore (claim atomique) + signaux
  runtime/        EmployeeRuntime + boucle ReAct + providers LLM
  tools/          read_file / write_file / run_shell (sandboxes)
  workspaces/     dossiers par employe (acquire/archive, ADR-014)
  sdk/            EmployeeClient / EmployeeCreator, in-process + HTTP/SSE,
                  runJobOnce / runClaimedJob (worker partage)
  server/         handler pur + adaptateur node:http + boucle worker
  cli/            commandes testables + E2E (cli.ts = env -> ctx)
```

## Donnees (`$EMPLOYEE_DATA`, defaut `.data/employee`)

`profiles/ employments/ missions/ jobs/ credentials/ memory/` — JSON
`0600`, un fichier par entite (+ `.lock` transitoires pour les jobs).
Fichiers corrompus : quarantaine `.corrupt.<ts>`, jamais de crash.

Workspaces (`$EMPLOYEE_WORKSPACES_DIR`, defaut `.data/workspaces/`) :
un dossier `<employeeId>/` par employe (cree au `hire`, archive au
`terminate`), racine effective des outils via `toolRoot()`.

## Tests

```bash
cd core/employee && ../../node_modules/.bin/vitest run   # ~250 tests
./node_modules/.bin/tsc --noEmit --incremental false     # depuis la racine
```

`cli/e2e.test.ts` : cles -> publish lie -> hire -> submit -> worker ->
statut -> events -> revocation, par la vraie couche CLI.

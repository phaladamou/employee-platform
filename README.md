# Employee — recrutez des travailleurs numériques, ne promptez plus des sessions

Et si les travailleurs IA se recrutaient, au lieu d'être promptés ?

Employee est une infrastructure de travail numérique autonome, construite
autour de trois acteurs :

- **Le Créateur** définit les métiers : il publie des employés avec un ADN
  verrouillé (profil versionné, outils autorisés, permissions).
- **L'Employeur** recrute un employé publié, lui confie des missions en
  langage naturel, suit leur exécution et reçoit un rapport vérifiable.
- **L'Employee** exécute : il planifie, utilise ses outils dans un sandbox,
  accumule une expérience vérifiable — et peut être recruté ailleurs, avec
  son historique.

Au cœur du système : une identité persistante (`emp_...`) qui ancre
l'historique des missions et la réputation professionnelle. Chaque agent
n'est plus une session jetable, mais un travailleur qui accumule de
l'expérience et construit un parcours vérifiable, transférable d'une
organisation à l'autre.

## Architecture (vue d'ensemble)

```
┌─────────────────────────────────────────────────────────┐
│  Interfaces                                             │
│   CLI (serve/hire/submit/status/events/keys)   Web (Next.js) │
└───────────────┬─────────────────────────┬───────────────┘
                │ REST /v1 + SSE          │
┌───────────────▼─────────────────────────▼───────────────┐
│  API : auth par clés emo_ + scopes, isolation tenants   │
│  Worker : claim atomique, exécution, annulation coop.   │
└───────────────┬─────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────┐
│  Noyau pur  core/employee/  (TypeScript, zéro framework) │
│   identités • profils versionnés • missions • mémoire    │
│   jobs async • runtime ReAct • outils sandboxés         │
└─────────────────────────────────────────────────────────┘
```

Le noyau ne dépend d'aucun framework et tourne seul (aucun import
React/Next/Electron — garanti par test). L'API et la CLI ne sont que des
adaptateurs autour de lui.

## Démarrage rapide (test E2E réel)

Prérequis : Node 22+, une clé `MUSE_API_KEY` (Meta) ou `DEEPSEEK_API_KEY`
dans `.env.local`.

```bash
# 1. Copie exécutable du noyau (sans tsx)
rm -rf .tmp/emp && mkdir -p .tmp/emp && cp -r core/employee/* .tmp/emp/
cd .tmp/emp && find . -name "*.ts" \
  -exec perl -pi -e 's/from "(\.\.?\/[^"]+?)(?<!\.ts)"/from "$1.ts"/g' {} +
alias emp="node --experimental-transform-types --no-warnings cli.ts"

# 2. Clés admin + employeur (jamais stockées en clair)
export EMPLOYEE_DATA=/tmp/emp-demo
emp keys issue --employer ops --admin --label root     # -> emo_...
emp keys issue --employer acme --label demo            # -> emo_...

# 3. Serveur API + worker
export EMPLOYEE_PROVIDER=muse   # ou deepseek (défaut)
emp serve --port 8000 &

# 4. Publier, recruter, missionner
export EMPLOYEE_API_URL=http://127.0.0.1:8000
export EMPLOYEE_TOKEN=<cle-admin>
emp publish --name Aria --role "Data Analyst" --spec data-analyst@1.0.0
export EMPLOYEE_TOKEN=<cle-acme>
emp hire emp_xxx
emp submit emp_xxx "Crée hello.txt avec 'bonjour' dedans et relis-le."
emp events job_xxx   # suit le job jusqu'au rapport final
```

Résultat attendu : `succeeded` + rapport ancré dans les observations
(`hello.txt` créé et relu dans le sandbox).

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — les 3 couches, Employee vs
  Employment, cycle de vie d'une mission.
- [docs/SECURITY.md](docs/SECURITY.md) — clés `emk_`/`emo_`, lockfile
  d'intégrité, isolation stricte des tenants.
- [docs/PROFILES.md](docs/PROFILES.md) — profils versionnés, catalogue,
  enforcement Fail Fast.
- [docs/CREATOR_VS_EMPLOYER.md](docs/CREATOR_VS_EMPLOYER.md) — la vision
  produit : qui définit l'ADN, qui recrute.
- [core/employee/README.md](core/employee/README.md) — référence technique
  du noyau (routes, CLI, données, tests).

## État du projet

- Noyau : 251 tests vitest verts, `tsc` zéro erreur, E2E live validé avec
  Muse (`muse-spark-1.3`, Meta Model API).
- Web : Next.js + Tailwind + PostgreSQL (auth OTP, onboarding, Talent
  Network, départements).
- Desktop : miroir Electron (releases via CI).

*Projet construit pendant le Meta Global AI Developer Hackathon
(26 oct. – 4 nov. 2026). Stack : Next.js, TypeScript, Meta Model API
(Muse Spark), Tailwind CSS, PostgreSQL.*

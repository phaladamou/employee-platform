# Employee — recruit digital workers, stop prompting disposable sessions 

What if AI workers could be recruited, not just prompted?

Employee is an infrastructure for autonomous digital work, built around
three actors:

- **The Creator** defines the trades: they publish employees with a locked
  DNA (versioned profile, allowed tools, permissions).
- **The Employer** recruits a published employee, assigns missions in
  natural language, follows execution, and receives a verifiable report.
- **The Employee** executes: it plans, uses its tools inside a sandbox,
  accumulates verifiable experience — and can later be recruited
  elsewhere, with its history.

At the core: a persistent identity (`emp_...`) anchoring mission history
and professional reputation. Each agent is no longer a disposable
session, but a worker that accumulates experience and builds a verifiable,
transferable track record across organizations.

## Architecture (overview)

```
┌─────────────────────────────────────────────────────────┐
│  Interfaces                                             │
│   CLI (serve/hire/submit/status/events/keys)   Web (Next.js) │
└───────────────┬─────────────────────────┬───────────────┘
                │ REST /v1 + SSE          │
┌───────────────▼─────────────────────────▼───────────────┐
│  API: emo_ key + scope auth, tenant isolation           │
│  Worker: atomic claim, execution, cooperative cancel    │
└───────────────┬─────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────┐
│  Pure core  core/employee/  (TypeScript, zero framework) │
│   identities • versioned profiles • missions • memory   │
│   async jobs • ReAct runtime • sandboxed tools          │
└─────────────────────────────────────────────────────────┘
```

The core depends on no framework and runs standalone (no React/Next/
Electron imports — enforced by test). The API and CLI are just adapters
around it.

## Quickstart (real E2E test)

Requirements: Node 22+, a `MUSE_API_KEY` (Meta) or `DEEPSEEK_API_KEY` in
`.env.local`.

```bash
# 1. Executable copy of the core (no tsx)
rm -rf .tmp/emp && mkdir -p .tmp/emp && cp -r core/employee/* .tmp/emp/
cd .tmp/emp && find . -name "*.ts" \
  -exec perl -pi -e 's/from "(\.\.?\/[^"]+?)(?<!\.ts)"/from "$1.ts"/g' {} +
alias emp="node --experimental-transform-types --no-warnings cli.ts"

# 2. Admin + employer keys (never stored in clear)
export EMPLOYEE_DATA=/tmp/emp-demo
emp keys issue --employer ops --admin --label root     # -> emo_...
emp keys issue --employer acme --label demo            # -> emo_...

# 3. API server + worker
export EMPLOYEE_PROVIDER=muse   # or deepseek (default)
emp serve --port 8000 &

# 4. Publish, recruit, assign
export EMPLOYEE_API_URL=http://127.0.0.1:8000
export EMPLOYEE_TOKEN=<admin-key>
emp publish --name Aria --role "Data Analyst" --spec data-analyst@1.0.0
export EMPLOYEE_TOKEN=<acme-key>
emp hire emp_xxx
emp submit emp_xxx "Create hello.txt with 'bonjour' in it and read it back."
emp events job_xxx   # follow the job to its final report
```

Expected result: `succeeded` + a report grounded in tool observations
(`hello.txt` created and re-read inside the sandbox).

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — the 3 layers, Employee vs
  Employment, mission lifecycle.
- [docs/SECURITY.md](docs/SECURITY.md) — `emk_`/`emo_` keys, integrity
  lockfile, strict tenant isolation.
- [docs/PROFILES.md](docs/PROFILES.md) — versioned profiles, catalog,
  Fail Fast enforcement.
- [docs/CREATOR_VS_EMPLOYER.md](docs/CREATOR_VS_EMPLOYER.md) — the product
  vision: who defines the DNA, who recruits.
- [core/employee/README.md](core/employee/README.md) — core technical
  reference (routes, CLI, data, tests).

## Project status

- Core: 251 green vitest tests, zero-error `tsc`, live E2E validated with
  Muse (`muse-spark-1.3`, Meta Model API).
- Web: Next.js + Tailwind + PostgreSQL (OTP auth, onboarding, Talent
  Network, departments).
- Desktop: Electron mirror (CI-built releases).

*Built during the Meta Global AI Developer Hackathon
(Oct 26 – Nov 4, 2026). Stack: Next.js, TypeScript, Meta Model API
(Muse Spark), Tailwind CSS, PostgreSQL.*

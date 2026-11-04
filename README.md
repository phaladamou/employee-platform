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

## In numbers

| Signal | Value | Source |
|---|---|---|
| Core tests (vitest) | **513 green / 514** in 54 files, ~20 s (1 env-gated: `emp-sandbox` needs `cargo build`, the CI builds it) | `pnpm test:employee` |
| Web lib tests (`node --test`) | **205 green / 205** in 24 files, 53 suites, ~6 s (scope note below) | `lib/**`, `core/models` |
| Native tests (Rust) | **27** (Ed25519, sandbox, Landlock) | `cargo test` in `rust/` |
| Adversarial regression cases | **23 committed** (forged proofs, cross-tenant reads/writes, lying employees, shell escapes, …) | [docs/TESTING.md](docs/TESTING.md) §4 |
| Test/code ratio (core) | ~11.8 k lines of tests for ~11.4 k lines of engine code | `core/employee/` |
| Type gate | `tsc --noEmit` clean on the committed tree | CI |
| Live LLM runs | **T1–T7 green** against Meta Muse (`muse-spark-1.3`): hire → work → proof, cross-tenant blocks, success semantics, GitHub fork → PR | [docs/TESTING.md](docs/TESTING.md) §3 |
| REST surface | 10 routes, 6 scopes, 6 error codes, 413 beyond 1 MB, SSE with heartbeat | [core/employee/README.md](core/employee/README.md) |
| Profile catalog | 6 trades + Chef + 3 legacy specs, SHA-256 lockfile, step budgets 10–32 | [docs/PROFILES.md](docs/PROFILES.md) |
| Decisions on record | **16 ADRs** (queue, cancel, proofs, Landlock, …) | [docs/DECISIONS.md](docs/DECISIONS.md) |
| Desktop | 70 packaged routes smoke-tested, 0 failures; 304 MB signed installer with auto-update | CI `desktop.yml` |

### Scoreboard

- **745 / 746 tests green (99,9 %)**: 513/514 vitest (99,8 %, 1 env-gated),
  205/205 `node --test` (100 %), 27/27 Rust (100 %).
- **50,9 % of core TypeScript is tests**: 11 829 lines of tests for
  11 424 lines of engine — the guarantee is executable, not aspirational.
- **7 / 7 live LLM runs green (T1–T7)** on Meta Muse, on top of 12
  calibration missions (2 per employee) + 4 limit tests (persistence,
  crash, cross-employee isolation, impossible mission).
- **67 % of catalog profiles are shell-less** (4/6: Aria, Newton, Milo,
  Sana) — least privilege by default; only Atlas (8 tools, 32 steps)
  and Nova earn `run_shell`, and every shell segment is allowlisted.
- **GitHub E2E passed on run 7**: 6 red runs, 6 root causes fixed and
  regression-tested (token scope, acceptance exemption, step budget,
  push idempotency) — the incident table is the proof of honesty.
- **70 / 70 packaged desktop routes green (100 %)** behind the
  anti-`MODULE_NOT_FOUND` gate; installer 304 MB, Cosign-keyless signed.
- **399 commits**, 9 docs (~1 600 lines), 16 ADRs, 5 `needs_review`
  triggers, 4 terminal job states — every number above traces to a
  file, a test, or a log quoted in [docs/TESTING.md](docs/TESTING.md).

Scope note: the 205-count covers every `node --test`-runnable file and
excludes two — `lib/db/talent-sync.test.ts` (runs inside the vitest
suite instead) and `lib/ai/models.test.ts`, a pre-existing orphan that
resolves its `@/` import under neither runner. The 27 Rust tests are
quoted from [docs/TESTING.md](docs/TESTING.md) (no `cargo` toolchain in
this sandbox to re-run them).

## Benchmarks (measured, not estimated)

Atlas (`atlas-software-engineer@1.0.0`) on a real server + worker +
Muse, N=4 average stored as the seed fiche:

| Mission | Tokens | Wall time | Peak RSS | Verdict |
|---|---|---|---|---|
| M1 — tools success (hello.py + `ls`) | 1 954 | 4.6 s | 127 MB | `succeeded` |
| M2 — tool-less success (report only) | 936 | 2.7 s | 130 MB | `succeeded` |
| M3 — honest-failure report | 2 926 | 7.0 s | 130 MB | `needs_review` (corroborated-inability detector) |
| Calibration — hello.py + `ls` | 2 130 | 5.1 s | 125 MB | `succeeded` |
| **Average (seed fiche)** | **1 987** | **4.9 s** | **128 MB** | + ~1 MB disk |

Absent provider usage stays absent (never a `0` that would read as
"proven free"); legacy or malformed consumption parses to `null`.
A full GitHub E2E (fork → clone → edit → push → PR, T7) costs ~10–15
Muse calls. Web chat streams the first token in ~2.3 s
(`reasoning_effort=minimal`).

Honest limits, documented rather than hidden: shell sessions are
one-shot (chain with `&&`); `networkAccess: false` is declared but not
enforced yet; `needs_review` claim detectors fail soft (unusual
phrasing can bypass them — never a false failure). Details in
[docs/TESTING.md](docs/TESTING.md) §5 and [docs/ROADMAP.md](docs/ROADMAP.md).

## Security in numbers

- **Keys**: 32 random bytes, SHA-256 hash at rest, `chmod 600`, TTL +
  revocation; forged/expired/revoked tokens get a uniform 401 (no
  oracle); cross-tenant reads get an indistinguishable 404.
- **Profiles**: every spec pinned by SHA-256 in `profiles.lock.json`;
  1 byte off = hard refusal at boot. Fail Fast runs before the first
  LLM call (unknown spec/tool, missing permission, over-budget steps,
  missing `PATH` binary) — zero tokens spent on doomed runs.
- **Confinement**: one workspace per employee (`toolRoot()` is the
  single decision point, escapes fail with `path escapes the
  workspace`); `run_shell` goes through `emp-sandbox` (Rust):
  Landlock policy (workspace RW, system RO, everything else denied at
  every access), timeout capped at 300 s (30 s default), 50 k-char
  observation cap, process-group kill.
- **Queue**: atomic claim (`wx` lock + 20×5 ms bounded retry), 15 s
  heartbeat lease, 120 s stale recovery, two-stage cooperative cancel
  (`cancellation_requested` → `cancelled`, never confused with
  `failed`).
- **Proofs**: Ed25519 completion certificates binding `(missionId,
  employerId, artifact hashes)`; signatures cross-verified byte-identical
  between Rust/WASM and Node in both directions; 1 flipped char =
  rejection (T4).

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
- [docs/TESTING.md](docs/TESTING.md) — suites, live T1–T7 runs,
  23 adversarial cases, honest coverage.
- [docs/DECISIONS.md](docs/DECISIONS.md) — 16 ADRs behind the guarantees.
- [docs/ERROR_HANDLING.md](docs/ERROR_HANDLING.md) — error codes, `failed`
  vs `needs_review` vs `cancelled` semantics.
- [docs/OPERATIONS.md](docs/OPERATIONS.md) — serve, scale workers, backup,
  recover, Docker.
- [docs/GITHUB_E2E.md](docs/GITHUB_E2E.md) — Atlas GitHub runbook:
  live fork/clone/edit/push/PR demo, token preconditions, incidents.
- [core/employee/README.md](core/employee/README.md) — core technical
  reference (routes, CLI, data, tests).

## Project status

- Core: 513 green vitest tests (+ 205 `node --test`, + 27 Rust),
  zero-error `tsc`, live E2E validated with Muse (`muse-spark-1.3`,
  Meta Model API).
- Web: Next.js + Tailwind + PostgreSQL (passwordless OTP auth —
  7 digits, 5 min TTL — onboarding, Talent Network, departments,
  Chef concierge).
- Desktop: Electron mirror (CI-built releases, 70-route packaged
  smoke gate, signed auto-updating installer).

*Built during the Meta Global AI Developer Hackathon
(Oct 26 – Nov 4, 2026). Stack: Next.js, TypeScript, Meta Model API
(Muse Spark), Tailwind CSS, PostgreSQL.*

## License

Copyright (c) 2026 Phal Adamou. All Rights Reserved.

This code is the exclusive property of Phal Adamou.
It is provided strictly for evaluation purposes for the Meta Global AI Developer Hackathon.
Any reproduction, distribution, modification, or commercial use is strictly prohibited without prior written consent.

See [LICENSE](LICENSE) for details.

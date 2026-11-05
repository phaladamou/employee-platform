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

## Why employees, why now

**What an Employee is.** Not a chatbot, not a disposable agent session
that forgets everything when the tab closes. An Employee is a digital
worker with a persistent identity (`emp_...`), a locked trade (its DNA:
tools, permissions, step budget), an employer contract, and a memory of
every mission it completed — portable from one organization to the next.

**The problem it solves.** Today's AI agents are amnesiac gig workers
with no papers: no verifiable history, no accountability for what they
claim, no way for the next employer to trust them. The industry feels
it — 96 % of enterprises already use AI agents in some capacity, yet
94 % of IT leaders worry they cannot control what they built
([OutSystems 2026](https://aivenconsultinggroup.ai/insights/outsystems-ai-agent-sprawl-governance-2026),
~1 900 leaders surveyed). Gartner predicts over 40 % of agentic AI
projects will be cancelled by end of 2027
([source](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027)).
The bottleneck is no longer capability — it is **trust, governance,
and verifiable work**. Employee answers exactly that: declared
acceptance criteria checked on disk, `succeeded` never self-certified,
every claim backed by tool evidence or routed to human review.

**Where the world is heading.** The numbers all point the same way:

- 33 % of enterprise software will include agentic AI by 2028, up from
  <1 % in 2024, and 15 % of day-to-day work decisions will be made
  autonomously ([Gartner](https://www.gartner.com/en/articles/3-bold-and-actionable-predictions-for-the-future-of-genai)).
- 40 % of enterprise apps will feature task-specific agents by end of
  2026, up from <5 % in 2025 ([Gartner, Aug 2025](https://gravity.fast/blog/ai-agent-adoption-statistics-2026/)).
- 54 % of organizations are actively deploying agents (KPMG Q1 2026),
  57 % already run them in production (LangChain, 1 340 teams), 67 %
  among companies with 10 000+ employees
  ([roundup](https://www.secondtalent.com/resources/ai-agents-statistics/)).
- The agent market grows from ~$11 B in 2026 to ~$52 B by 2030, ~44 %
  CAGR ([Precedence/Business Research](https://www.thebusinessresearchcompany.com/report/ai-agents-global-market-report)).

When a third of enterprise software *is* agents, "prompting a session"
stops scaling. Work will be **assigned to workers, not typed into
boxes** — recruited by trade, contracted, supervised, and paid by
result. The interface of work becomes the org chart, not the chat box.
That is the norm Employee is built for: a Talent Network where you
recruit an Atlas or an Aria the way you hire a contractor — with a
signed track record instead of a sales pitch.

**Why cryptography is load-bearing, not decorative.** A CV a worker
writes about itself is worthless; a CV *no one can forge* is currency.
Every completed mission carries an Ed25519 completion proof binding
`(missionId, employerId, artifact hashes)` to the operator key —
publicly verifiable, one flipped character away from rejection.
Profiles are SHA-256-pinned (one byte off = refusal to boot), keys live
only as hashes. Trust then needs no platform blessing: any future
employer can verify the work mathematically, including selectively
(disclose the proof, keep the report content private). Portable
reputation is what turns disposable sessions into **careers** — and
careers are what make digital employment a labor market instead of a
demo.

## One trade, one machine: why environments are profession-shaped

**What an AI employee really is.** A model is a brain without hands;
an AI employee is that brain **embodied in a workstation built for its
trade**: its tools, its permissions, its files, its shell allowlist, its
step budget. You would not seat a data analyst at a dev's machine full
of deploy keys, nor ask a developer to ship code from a laptop with no
compiler. Same principle here — except the workstation is enforced by
code, not by IT policy.

**A dev and an analyst have nothing in common operationally.** Compare
two shipped profiles:

| Need | Atlas (Software Engineer) | Aria (Data Analyst) |
|---|---|---|
| Tools | 8: files + shell + 5 GitHub tools | 2: `read_file`, `write_file` — no shell |
| Shell binaries | `python3`, `pip`, `pytest`, `git` + inspection base | none usable (no `run_shell` at all) |
| Prerequisites on `PATH` | `python3`, `pip`, `pytest`, `git` — mission refused pre-LLM if missing | none — needs no toolchain |
| Step budget | 32 (build → test → verify loops) | 12 (read → analyze → report) |
| Workspace | own directory + Landlock jail for shells | own directory, file tools only |

Atlas can fork a repo, push a branch, and open a PR; Aria literally
cannot execute a command — the model never even sees `run_shell` in its
catalog, and attempting it returns `unknown tool`. The ban is
structural, not a prompt instruction the model could ignore. A
researcher (Newton: 10 steps, no shell, no prerequisites) or a DevOps
engineer (Nova: shell but **no** `write_file` — it runs pipelines, it
never edits source) are shaped just as deliberately. Six trades, six
machines — see [docs/PROFILES.md](docs/PROFILES.md).

**How we design it: the Mini-Ordinateur.** Each profile carries a
`computer` block — the machine spec for that trade: allowed binaries
(every `&&`/`;`/`|` segment checked before execution), timeout and
memory ceilings, a dedicated workspace directory, and a declared
network intent. Enforcement is layered and Fail Fast:

1. **Before the first LLM call**: the registry resolves the exact
   `name@version` DNA, checks tool/permission/step coherence, and
   verifies `environment` binaries on `PATH` — any gap refuses the
   mission with zero tokens spent.
2. **At every tool call**: file tools resolve through `toolRoot()` (one
   decision point — escapes fail with `path escapes the workspace`);
   shells run through `emp-sandbox`, where a Landlock policy confines
   the process to its workspace (RW) with the system read-only.
3. **After the run**: acceptance criteria (`--expect-file`,
   `--expect-test`) are verified on disk; GitHub missions are verified
   through the GitHub API, never by trusting the report.

The result: least privilege follows the employee to every employer. A
shell-less researcher stays shell-less everywhere — security is a
property of the worker, not of each client's discipline.

## Powered by Meta models

Employee runs on **Muse Spark 1.3** (`muse-spark-1.3`), Meta's frontier
reasoning model, called through the **Meta Model API**
(`https://api.meta.ai/v1`, OpenAI-compatible) with a `MUSE_API_KEY`
from [dev.meta.ai](https://dev.meta.ai/resources/blog/build-with-muse-spark).
Every live run quoted in this README — T1–T7, the Atlas N=4 benchmarks,
the GitHub fork → PR demo — executed on Muse Spark 1.3. The web chat
streams its first token in ~2.3 s via `reasoning_effort=minimal`, and
the core stays provider-agnostic (`EMPLOYEE_PROVIDER=muse|deepseek`,
same `FetchLLMProvider` interface) so no workload is locked to one lab.

Why Meta's stack fits this project, built for the Meta Global AI
Developer Hackathon (Oct 26 – Nov 4, 2026):

- **Muse Spark 1.3** (Meta Superintelligence Labs, Sept 2, 2026): the
  model behind Meta AI and Muse Code, 1 M-token context, built for
  reasoning, coding, and agent work — exactly the ReAct loop Employee
  runs ([guide](https://www.bitsminds.com/guides/muse-spark-complete-guide),
  [$1.25/$4.25 per M tokens](https://tokensave.app/blog/muse-spark-1-3-api-pricing)).
- **Muse Glimmer 30B** (Aug 10, 2026, Apache 2.0, open weights on
  Hugging Face): Meta's open counterweight for self-hosted inference
  ([overview](https://moelueker.com/blog/how-to-use-llama4-for-free)).
- **Llama 4 Scout & Maverick** (Apr 2025, open weights): the MoE herd —
  Scout (17 B active / 109 B, 10 M context) and Maverick (17 B active /
  400 B, 1 M context) — still downloadable; Meta's hosted Llama API
  shut down July 2026, so they live on self-hosted rails
  ([specs](https://www.secondtalent.com/resources/every-llama-ai-model-explained-compared/)).

Frontier API for production missions, open weights for sovereign
deployments: the same Employee DNA runs on both, because the trade —
not the model — is the unit of trust.

**Baseten is the open-models rail**: Muse Glimmer 30B and Llama 4
deploy on Baseten (hosted Model APIs or dedicated Truss
deployments), both OpenAI-compatible, so they plug into the same
provider interface with zero core changes — first for
cost-sensitive workloads (judges, summaries), graduated by evals.
How models plug in today and how new Meta releases keep landing
(next: Glimmer eval vs Spark, task-based routing, per-mission cost
ledger) is recorded in [docs/MODELS.md](docs/MODELS.md).

## In numbers

| Signal | Value | Source |
|---|---|---|
| Core tests (vitest) | **513 green / 514** in 54 files, ~20 s (1 env-gated: `emp-sandbox` needs `cargo build`, the CI builds it) | `pnpm test:employee` |
| Web lib tests (`node --test`) | **250 green / 250** in 28 files, 69 suites, ~10 s (scope note below) | `lib/**`, `core/models` |
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

- **790 / 791 tests green (99,9 %)**: 513/514 vitest (99,8 %, 1 env-gated),
  250/250 `node --test` (100 %), 27/27 Rust (100 %).
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
- **399 commits**, 11 docs (~1 700 lines), 16 ADRs, 5 `needs_review`
  triggers, 4 terminal job states — every number above traces to a
  file, a test, or a log quoted in [docs/TESTING.md](docs/TESTING.md).

Scope note: the 250-count covers every `node --test`-runnable file and
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
- [docs/MODELS.md](docs/MODELS.md) — model integrations: Muse Spark
  live today, Baseten rail for Glimmer/Llama 4, eval-gated adoption.
- [core/employee/README.md](core/employee/README.md) — core technical
  reference (routes, CLI, data, tests).

## Project status

- Core: 513 green vitest tests (+ 250 `node --test`, + 27 Rust),
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

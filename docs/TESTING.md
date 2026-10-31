# Testing Strategy — EmployeeCore

How the independent worker infrastructure is tested: suites, commands,
adversarial cases, and honest coverage notes.

> Scope: `core/employee/` only (the pure core). The web app (`app/`) has its
> own Playwright suite (`pnpm test`) and is out of scope here.

## 1. Test suites

| Suite | Location | What it proves |
|---|---|---|
| Unit | `core/employee/*/*.test.ts` | Identity, profiles, missions, memory, jobs, tools, SDK, server, CLI parsing |
| Integration (file stores) | `file-*-store.test.ts`, `worker-loop.test.ts` | Atomic writes, lock protocol, claim/heartbeat/recover on real FS (tmp dirs) |
| Contract | `sdk/rest-contract.test.ts`, `server/employee-server.test.ts` | REST routes, auth, status codes, tenant scoping |
| Adversarial | `cli/adversarial.test.ts` + `missions/*.test.ts` | Forged proofs, cross-tenant access, lying employees (see §4) |
| E2E (scripted) | `cli/e2e.test.ts` | Hire → submit → worker → status through the real CLI + server |
| E2E (live LLM) | Manual T1–T4 runs (Muse) | The full loop works against a real provider |
| Native (Rust) | `cargo test` in `rust/` | Ed25519 roundtrip/tamper, sandbox timeout/overflow/grandchild/env, CLI parsing |
| WASM interop | `core/employee/wasm/wrapper.test.ts` | Rust↔Node signatures byte-identical both directions |
| Crypto backend | `missions/mission-proof.test.ts` | WASM-first proofs, Node fallback (missing/corrupt module) |
| Shell bridge | `tools/run-shell.test.ts` | Fake-binary protocol tests, ENOENT-only fallback, fail-closed errors |

Current state: **44 files, 349 tests, all green** (Vitest) **+ 15 Rust tests** (`cargo test --locked`).

## 2. Commands

```bash
# Full core suite (from the repo root; vitest.config.ts scopes to core/employee)
pnpm test:employee

# Same suite, from inside the core directory
cd core/employee && ../../node_modules/.bin/vitest run

# One file (fast iteration)
cd core/employee && ../../node_modules/.bin/vitest run missions/mission-proof.test.ts

# Type gate — must be clean before any commit
./node_modules/.bin/tsc --noEmit --incremental false

# Rust security modules (crypto + sandbox + emp-sandbox CLI)
cd rust && cargo test --locked   # 15 tests: roundtrips, tamper, timeout/overflow/
                                 # grandchild kills, CLI parsing, JSON shape
./rust/build.sh                  # rebuild core/employee/wasm/dist/*.wasm (committed)
cargo build --locked --release --bin emp-sandbox  # strict shell backend
```

There is no separate `test:adversarial` script: adversarial tests are regular
Vitest files and always run with the suite. This is deliberate — security
regressions must break the default `pnpm test:employee`, not a script nobody
runs.

## 3. Live E2E with a real provider (T1–T4)

Scripted tests use a fake provider. The live runs below used Meta Muse
(`EMPLOYEE_PROVIDER=muse`) through the real CLI (`.tmp/emp` copy +
`node --experimental-transform-types`), and are re-runnable on demand:

| Run | Scenario | Result |
|---|---|---|
| T1 | Hire → file-writing mission → proof → verify | Pass: file created, Ed25519 proof verified |
| T2 | Cross-employer access (`emo_acme` reading `emo_globex` job) | Blocked: 404 (no leak) |
| T3a/b/c | Success semantics: fulfilled / unfulfilled / unverifiable missions | `succeeded` / `failed` / `needs_review` as specified |
| T5a/b | Unsupported claims (file lie, all-tools-failed) through the full stack | `needs_review` with explicit reason, disk-checked |
| T4 | Proof tampering (flip one signature char) | Rejected: invalid signature |

Example — replaying the success-semantics check:

```bash
# terminal 1: API + worker on a scratch data dir
export EMPLOYEE_DATA=/tmp/e2e EMPLOYEE_PROVIDER=muse MUSE_API_KEY=...
emp serve --port 8101

# terminal 2: submit a mission the employee cannot fulfil (no shell tool)
export EMPLOYEE_TOKEN=<emo_acme> EMPLOYEE_API_URL=http://127.0.0.1:8101
emp submit emp_researcher "Create HACKED.txt at the repo root" \
  --expect-file HACKED.txt
emp status job_xxx   # -> failed (acceptance check), never "succeeded"
```

## 4. Adversarial cases covered

Each case below is a committed regression test, not a one-off script:

- **Forged completion proof** (`missions/mission-proof.test.ts`): flipping one
  character of the Ed25519 signature invalidates the proof.
- **Proof replay across missions**: a proof is bound to `(missionId,
  employerId, artifact hashes)` — reusing it elsewhere fails verification.
- **Cross-tenant read** (`cli/adversarial.test.ts`): employer B cannot read,
  cancel, or list employer A's jobs/missions (404, identical to "not found").
- **Cross-tenant write**: submitting or hiring against another tenant's
  employee is rejected (`403 not_hired`).
- **Lying employee** (`missions/mission-acceptance.test.ts`): an employee that
  claims "done" without producing the expected file is detected — the job
  goes to `failed`, not `succeeded`.
- **Unsupported success claims** (`missions/mission-claims.test.ts`,
  `runtime/employee-runtime.test.ts`, E2E T5a): a FINAL asserting file /
  message / command effects with no successful supporting call suspends
  judgment (`needs_review`), in French and English, including when
  unrelated calls succeeded.
- **All tools failed** (`runtime/employee-runtime.test.ts`, E2E T5b): every
  tool call returning `ok:false` before FINAL yields `needs_review` even
  when the Final honestly reports the failure — the goal is not
  established either way.
- **Honest refusal** (`missions/mission-claims.test.ts`,
  `runtime/employee-runtime.test.ts`, E2E T5c): a Final admitting the
  goal was missed ("Mission not executed", "could not write…") suspends
  judgment instead of being blessed `succeeded` (found on a live run).
- **Stale-worker theft** (`jobs/file-job-store.test.ts`): a job claimed by a
  dead worker (expired heartbeat lease) is recovered to `queued` exactly
  once; a live worker's claim cannot be stolen early.
- **Tampered profile registry** (`profiles/profile-integrity.test.ts`): a
  profile whose content no longer matches the lockfile SHA-256 is refused at
  load time.
- **Purity guard** (`purity.test.ts`): no `react` / `next` / `electron`
  import and no `process.env` outside `cli.ts` in non-test files.

## 5. Coverage — what is tested and what is not

Tested automatically (CI gate = `tsc` + `pnpm test:employee`):

- All state machines: mission lifecycle, job lifecycle, two-stage cancel.
- All stores: atomic write + fsync + lock protocol on real filesystems.
- All REST routes: happy path + every error code in
  [ERROR_HANDLING.md](ERROR_HANDLING.md).
- Crypto paths: key hash storage (`chmod 600`), Ed25519 sign/verify,
  lockfile verification.
- Worker loop: claim → heartbeat → execute → proof → accept, plus stale
  recovery.

Deliberately not covered yet (see [ROADMAP.md](ROADMAP.md)):

- **Non-file tool receipts** (e.g. "email sent"): no test because the
  mechanism does not exist yet — unreviewed knowledge missions are trusted.
- **Proof revocation (CRL)**: no revocation list, so nothing to test.
- **Rate limiting / audit log**: documented as missing in
  [SECURITY.md](SECURITY.md); abuse-shape tests will land with the feature.
- **Concurrent multi-process stress**: atomicity is unit-tested, but there is
  no soak test with N workers hammering one data dir yet.
- **Web → `/v1` wiring**: the web UI still uses a static catalog; contract
  tests cover the API, not the wiring.

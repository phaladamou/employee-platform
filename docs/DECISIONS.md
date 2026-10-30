# Architecture Decision Records — EmployeeCore

Major technical choices, why they were made, what was rejected, and what
each choice costs. Numbered ADRs; newest last.

## ADR-001 — Pure core in `core/employee/`, zero UI imports

- **Context.** The worker engine must outlive any interface (web today,
  desktop tomorrow, headless deployments later). Framework imports inside
  business logic would couple the engine's release cycle to the UI's.
- **Decision.** All engine code lives in `core/employee/` with no `react` /
  `next` / `electron` imports and no `process.env` reads except in the CLI
  entrypoint (`cli.ts`). Enforced by `purity.test.ts`, which fails the suite
  on violation.
- **Rejected.** (a) Colocating engine code in `app/` or `lib/` — convenient
  but untestable in isolation and coupled to Next.js releases. (b) A separate
  npm package — premature; the purity guard gives 90% of the benefit with
  none of the publish/version overhead.
- **Consequences.** The CLI runs from a plain `.ts` copy via
  `node --experimental-transform-types` (no tsx, no build step). Any future
  extraction into a package is mechanical.

## ADR-002 — Ed25519 for completion proofs

- **Context.** When a mission finishes, the system needs a tamper-evident
  receipt binding `(missionId, employerId, artifact hashes)` to the operator.
- **Decision.** Ed25519 signatures (Node `crypto`, no dependency), one
  operator keypair per deployment, over a SHA-256 digest of the proof body.
- **Rejected.** (a) HMAC — symmetric: anyone who can verify can also forge,
  so proofs could not be shown to third parties. (b) RSA — larger keys and
  signatures for no benefit at this scale. (c) No signature (hash only) —
  detects corruption but not forgery; the T4 tamper test requires forgery
  resistance.
- **Consequences.** Proofs are publicly verifiable but not yet revocable
  (no CRL — see [ROADMAP.md](ROADMAP.md)). Key rotation procedure is
  documented in [OPERATIONS.md](OPERATIONS.md).

## ADR-003 — SHA-256 lockfile for employee profiles

- **Context.** Employee profiles (`role`, tools, system prompt) define what
  an employee *may* do. A silent edit (malicious or accidental) would change
  behavior without changing the version string.
- **Decision.** A lockfile pins every profile version to its SHA-256 hash;
  the registry refuses to load a profile whose content does not match, at
  server boot and at worker start.
- **Rejected.** (a) Trusting the filesystem — no integrity signal at all.
  (b) Signing profiles with the operator key — stronger, but couples profile
  authoring (frequent, possibly third-party) to operator key access.
  Signatures remain the planned upgrade (see ROADMAP).
- **Consequences.** Profile edits require a lockfile refresh (explicit,
  reviewable diff). A tampered profile fails closed: the server refuses to
  boot rather than running unknown code paths.

## ADR-004 — API key prefixes `emk_` (creator) / `emo_` (employer)

- **Context.** Two key families with different powers (creator keys publish
  profiles and issue keys; employer keys hire and submit) must be
  distinguishable at a glance — in logs, in support tickets, in `.env` files.
- **Decision.** Visible prefixes: `emk_…` for creator/master keys,
  `emo_…` for employer keys. Only the SHA-256 hash is stored
  (`credentials/`, `chmod 600`); the prefix is part of the stored record, not
  of the secret.
- **Rejected.** (a) Unprefixed opaque tokens — Stripe-style prefixes cost
  nothing and prevent "wrong key family" misconfigurations. (b) JWTs —
  revocation would need a denylist; opaque handles revoke by deleting one
  file (`emp keys revoke`).
- **Consequences.** Prefix checks are cosmetic only — authorization always
  goes through the credential store (scopes + employer binding). Never gate
  on the prefix alone.

## ADR-005 — `employerId` derived from the token, never from the client

- **Context.** Every read and write must be scoped to exactly one tenant.
  Accepting `employerId` as a request parameter would make cross-tenant
  access a one-field mistake away.
- **Decision.** The server resolves `employerId` exclusively from the
  authenticated credential (`Authorization: Bearer emo_…`). Requests carry no
  tenant field; there is nothing to spoof.
- **Rejected.** (a) Client-supplied `employerId` with a server-side check —
  correct when done perfectly, but every new route re-implements the check
  and one omission leaks a tenant. (b) Subdomain/path tenancy — operational
  complexity with no security gain over token binding.
- **Consequences.** Unknown/forged tokens get `401`; valid tokens for the
  wrong tenant get `404` (not `403`) on reads, so existence is not leaked.
  Key compromise = tenant compromise, hence TTL + revocation + `chmod 600`.

## ADR-006 — At-least-once queue with atomic claims

- **Context.** Workers crash. A job claimed by a dead worker must run again,
  but two live workers must never run the same job concurrently.
- **Decision.** File-backed queue: `claim` is an atomic
  write-temp + fsync + rename guarded by an exclusive lock; the claim carries
  a heartbeat lease, and `recoverStaleJobs` re-queues claims whose lease
  expired.
- **Rejected.** (a) Exactly-once — impossible without distributed consensus;
  claiming it would be dishonest. (b) An external broker (Redis/RabbitMQ) —
  a network dependency and an ops burden for a single-node engine; the file
  protocol gives crash safety with zero services.
- **Consequences.** A job may execute twice (crash between side effect and
  state write). Tools that cannot tolerate duplicates need idempotency
  receipts — tracked in ROADMAP for non-file effects.

## ADR-007 — Success is verified, never self-certified

- **Context.** T3 showed the failure mode: an employee without shell access
  "completed" a file-creation mission and the job was marked `succeeded`
  although nothing was created.
- **Decision.** Missions declare verifiable expectations (`--expect-file`,
  `--expect-contains`); the worker checks them after execution. Fulfilled →
  `succeeded`; checkable but unfulfilled → `failed`; not automatically
  checkable → `needs_review` for a human. An employee's own "done" claim is
  evidence, never verdict.
- **Rejected.** (a) Trusting the model transcript — models confabulate
  completion. (b) A binary pass/fail with no middle state — forces
  unverifiable missions into either false success or false failure.
- **Consequences.** Submitters must think about "how will I know it worked"
  at submit time. Honest report of what is checked automatically lives in
  [TESTING.md](TESTING.md) §3–§4.

## ADR-008 — Two-stage job cancellation

- **Context.** Cancelling a running job must stop the model's tool loop
  promptly without corrupting store state.
- **Decision.** `cancel` writes a `cancellation_requested` state that the
  running worker polls between tool steps (cooperative); the worker then
  stops cleanly and confirms with `markCancelled`, which releases the claim.
- **Rejected.** (a) Immediate state flip — the worker would keep running
  orphaned, possibly writing results into a cancelled job. (b) `SIGKILL` of
  the worker process — kills every job on that worker, not just the target.
- **Consequences.** Cancellation is fast but not instantaneous; clients
  should poll `status` until the terminal state lands.

## ADR-009 — Unsupported success claims suspend judgment (heuristic)

- **Context.** ADR-007 verifies missions *with* declared criteria, but a
  criterion-less mission whose Final claims "Created HACKED.txt" or "Email
  sent" with zero supporting tool calls was still marked `succeeded`: a
  parseable Final was the whole verdict. Reproduction V2/V3/V4 proved it.
- **Decision.** Two added signals, both fail-soft into `needs_review`
  (never auto-`failed`): (1) deterministic — tool calls were attempted but
  *all* failed (`ok:false`); (2) heuristic — the Final asserts concrete
  file/message/command effects (strict FR+EN patterns in
  `missions/mission-claims.ts`, each requiring a success verb plus a
  concrete artifact) that no successful call of a supporting tool backs.
  Message claims are never supportable: no send tool exists in the core.
- **Rejected.** (a) Auto-`failed` on any file-less mission — would punish
  legitimate knowledge missions whose report *is* the deliverable.
  (b) A `blocked` state for "impossible goals" — impossibility is only
  observable after the fact (unknown-tool attempt); fail-fast blocking
  needs submitter-declared requirements, which the API does not have
  (ROADMAP item). (c) Full NLP claim analysis — unbounded false-positive
  surface; strict patterns plus human review bound the blast radius.
- **Consequences.** `needs_review` now has three documented triggers
  (ERROR_HANDLING.md). Pattern misses are false negatives (a lie phrased
  unusually still succeeds by trust), never false failures: nominalizations
  ("procédé à la création"), off-list synonyms ("generated", "delivered")
  and vague claims ("all files in place") all bypass the patterns —
  verified by probe, accepted as a known limit. Third-party agents
  ("created by the user") are excluded to protect legitimate research
  reports. The robust path stays unchanged: declare acceptance criteria.

## ADR-010 — Rust for security-critical modules (WASM crypto, native sandbox)

- **Context.** Two components carry disproportionate risk: Ed25519
  signing/verification (forgery breaks mission proofs) and subprocess
  execution (a hostile child must never escape, hang, or OOM the host).
  The TypeScript core is intentionally dependency-free and must stay so.
- **Decision.** A `rust/` crate (`employee-native`) implements both:
  `crypto` (Ed25519 via `ed25519-dalek`, no-std-compatible, compiled to
  `wasm32-unknown-unknown` and driven from TypeScript through a minimal
  hand-rolled ABI + `rust/ts` wrapper — no wasm-bindgen CLI needed);
  `sandbox` (argv-direct spawn, wall-clock kill, concurrent output caps,
  Unix rlimits) compiled for native targets only, cfg-gated out of WASM
  (processes cannot exist there). Entropy comes from the host
  (`crypto.randomBytes`), never from in-WASM randomness.
- **Rejected.** (a) Pure-Node crypto everywhere — fine functionally, but a
  memory-safe, dependency-audited Rust core raises the bar for the exact
  code attackers target. (b) wasm-bindgen + wasm-pack — heavier toolchain
  (CLI post-processing, npm glue) for an ABI small enough to hand-roll
  and audit in one file. (c) Rewriting the TS core in Rust — rejected:
  the core stays TypeScript; Rust covers two modules, nothing more.
- **Consequences.** Interop is proven, not assumed: the wrapper test
  cross-verifies signatures against Node `crypto` in both directions
  (byte-identical). The built `.wasm` is committed
  (`core/employee/wasm/dist/`) so tests run without a Rust toolchain;
  `rust/build.sh` rebuilds it. Mission proofs sign/verify through the
  WASM module first, with a Node fallback on any load failure (same
  bytes either way — Ed25519 is deterministic). The sandbox ships an
  `emp-sandbox` binary bridged from `run_shell` (`EMPLOYEE_SANDBOX_BIN`;
  ENOENT-only fallback, everything else fails closed).

## ADR-011 — Docker image for isolated execution

- **Context.** The API + worker run as a plain host process with the
  user's privileges and a writable tree — acceptable for development,
  weak as a deployment story.
- **Decision.** A single `Dockerfile` (API + worker, `node:22-slim`):
  non-root user (`node`, uid 1000), read-only root filesystem (only
  `/tmp` tmpfs and the `/data` + `/sandbox` volumes writable), resource
  envelope enforced at run time (`-m 512m --cpus=1.0`), healthcheck on
  the authenticated probe (`401` = alive). Same image serves API and
  extra workers (`CMD` override). The image was logic-validated
  (transform byte-identical to the README recipe, smoke-tested CLI);
  `docker build` itself could not run in the dev sandbox (no daemon).
- **Rejected.** (a) One image per role — the roles are one binary with
  different argv; two images would only drift. (b) Baking limits into the
  image — impossible by design; limits live with the orchestrator and
  are documented as run flags. (c) Kubernetes manifests — still
  premature (see ROADMAP non-goal); plain `docker run` first.
- **Consequences.** Deployment gains a reproducible, least-privilege
  unit. The Dockerfile pins only `dotenv` (the core's single
  dependency); everything else is the dependency-free core.

## ADR-012 — Keyless Cosign signing of release artifacts

- **Context.** The Windows installer (`.exe`) is published to GitHub
  Releases with no integrity proof: users cannot tell a genuine build
  from a tampered upload.
- **Decision.** The `desktop` workflow signs every installer with Cosign
  keyless (Fulcio OIDC, `id-token: write`, no long-lived keys to guard):
  `sign-blob` emits `.sig` + `.pem` next to the `.exe`, a `verify-blob`
  step re-verifies immediately (pinned to this repo's identity), and all
  three files ship as workflow artifacts and release assets.
- **Rejected.** (a) Long-lived Cosign keys in secrets — key custody and
  rotation burden for no benefit over keyless OIDC. (b) Signing only on
  tags — signing every packaged build (including manual dispatches)
  keeps the path exercised and artifacts uniformly verifiable.
- **Consequences.** Anyone can verify an installer against the Sigstore
  transparency log with the repo identity. The workflow needs no new
  secrets; revocation is the platform's (Fulcio/Rekor), not ours.

## ADR-013 — Honest refusals suspend judgment (refusal admissions)

- **Context.** A live run showed the mirror of ADR-009: a researcher
  asked for a shell command declined honestly in Final ("Mission not
  executed… No file was created") without attempting anything — and the
  job was marked `succeeded`, its status contradicting its own report.
- **Decision.** A second fail-soft signal in `missions/mission-claims.ts`:
  explicit non-completion admissions (strict FR+EN patterns bound to
  completion verbs — "could not write" counts, "could not find" does
  not) route the mission to `needs_review`, never auto-`failed`.
- **Rejected.** (a) Trusting honest text as success — the report would
  say "not done" while the status says "done". (b) Auto-`failed` —
  the human reviewer may legitimately accept a correct decline (retry
  with other means) or confirm failure; the verdict is theirs.
- **Consequences.** `needs_review` has four documented triggers
  (ERROR_HANDLING.md). Same known limit as ADR-009: unusual phrasing
  bypasses the patterns (false negatives, never false failures).

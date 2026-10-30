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

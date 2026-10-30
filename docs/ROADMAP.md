# Roadmap — EmployeeCore

Done, next, and long-term. Updated when a milestone lands; each item links
to the doc or ADR that defines "done".

## 1. Done — the three guarantees + verified success

| Milestone | Guarantee | Proved by |
|---|---|---|
| B1 — Employer keys + EmploymentStore | Only hired employees work for you | `403 not_hired`, adversarial T2 |
| B2 — Scoped memory | No memory leaks across tenants | `memory/*` tests, token-derived `employerId` (ADR-005) |
| B3 — Jobs + lock + cancel | One job runs once at a time; cancel is clean | Claim atomicity tests, two-stage cancel (ADR-008) |
| B4 — Split SDK (creator/employer) | Least privilege by construction | `sdk/*` tests, `emk_`/`emo_` (ADR-004) |
| B5 — REST + auth + adapter | Every route authenticated, tenant-scoped, contract-tested | `rest-contract.test.ts`, T2 |
| B6 — CLI + E2E + docs | The whole loop works from a terminal | `e2e.test.ts`, live Muse runs T1–T4 |
| Recovery audit | A dead worker loses no job | `recoverStaleJobs`, stale-lease tests |
| Completion proofs | Finished work carries a forgery-resistant receipt | Ed25519 proofs (ADR-002), T4 tamper test |
| Verified success | `succeeded` means the goal was checked, not claimed | Acceptance checks, `needs_review` (ADR-007), T3a/b/c |

Net: **42 test files, 326 tests green, `tsc` clean**, live-verified against
Meta Muse. The engine runs standalone (API + N workers, zero external
services besides the LLM provider).

## 2. Remaining — hardening before scale

Ordered by risk reduction, not by ease.

1. **Tool receipts for non-file effects.** File expectations
   (`--expect-file`) are verified; "email sent", "API call made" are not.
   Unreviewed knowledge missions are still trusted. *Done = every tool
   emits a signed receipt the acceptance check can verify; T3-style live
   test for an email mission.*
2. **Structured logging + audit trail.** Today the job/mission records are
   the only trail and 500 details are swallowed. *Done = one JSON line per
   request and per worker transition; an append-only audit log for all
   mutations.*
3. **API rate limiting.** No throttle exists; a leaked `emo_` key can flood
   the queue and the LLM bill. *Done = per-credential rate limits +
   abuse-shape tests (documented in SECURITY.md).*
4. **Proof revocation (CRL).** Proofs verify forever, even if the operator
   key is rotated after compromise. *Done = revocation list consulted by
   `verify`, with rotation procedure tested.*
5. **Remote signing.** The operator key lives on the worker host. *Done =
   proofs signed via a remote signer (or HSM/KMS) so a host breach does not
   forge history.*
6. **Multi-process soak test.** Atomicity is unit-tested but N workers have
   never hammered one data dir under load. *Done = a stress run in CI or a
   documented manual procedure.*
7. **Web → `/v1` wiring.** The web UI still serves a static catalog; the
   API is contract-tested but no UI path calls it. *Done = Talent Directory
   "Recruit" performs a real `hire`, with the session token mapped to an
   `emo_` credential.*
8. **Declared tool requirements → fail-fast `blocked`.** Today a goal that
   is impossible with the employee's tools is only detected after the run
   (unknown-tool attempt → `needs_review`). *Done = `submit` accepts
   required tools; the server refuses with `blocked` (no LLM cost) when
   the profile cannot provide them.*

## 3. Long-term vision

- **Signed profiles (upgrade of ADR-003).** Third-party profile authors
  sign their specs; the registry verifies author + integrity, enabling a
  profile ecosystem without trusting the filesystem.
- **Talent marketplace.** Public discovery of employee profiles with
  ratings, versioning, and per-mission pricing — the Talent Directory UI
  backed by real hires and real proofs of completed work.
- **Large-scale multi-tenancy.** Sharded data dirs per tenant (or a real
  store behind the `*Store` interfaces — they were designed for exactly
  this swap), horizontal workers, per-tenant quotas.
- **Policy engine.** Employer-defined guardrails ("this employee may never
  touch production credentials") enforced at the tool layer, not in the
  prompt.
- **No Docker/Kubernetes for now** — a deliberate non-goal until the
  hardening list above is done. Single-binary-plus-files deploys anywhere;
  orchestration comes after guarantees.

## 4. How to read this file with the others

- *Why* each done item looks the way it does → [DECISIONS.md](DECISIONS.md).
- *How* each done item is proven → [TESTING.md](TESTING.md).
- *What breaks* and how to react → [ERROR_HANDLING.md](ERROR_HANDLING.md).
- *How to run* all of it → [OPERATIONS.md](OPERATIONS.md).

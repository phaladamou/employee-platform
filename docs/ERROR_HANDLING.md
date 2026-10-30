# Error Handling — EmployeeCore

API error codes, failure semantics (retry, recovery, `needs_review`,
`failed`), and where to find logs.

## 1. API error codes

All errors share one JSON shape:

```json
{ "error": "<code>", "message": "<human-readable detail>" }
```

| HTTP | `error` | Meaning | Example |
|---|---|---|---|
| 400 | `bad_request` | Malformed request (invalid JSON, missing field, unknown status filter) | `POST /v1/missions` without `employeeId` |
| 401 | `unauthorized` | Missing, unknown, expired, or revoked token | Wrong `emo_…` token, or none at all |
| 403 | `not_hired` | Authenticated, but no active employment for this employee | Submitting to an employee you never hired (or were fired from) |
| 404 | `not_found` | Unknown route, or resource outside your tenant | Reading another employer's job (deliberately indistinguishable from "does not exist") |
| 409 | `conflict` | State transition refused | Cancelling an already-finished job |
| 500 | `internal` | Unexpected server failure (bug or disk error) | Store write failure mid-request |

Design notes:

- **401 vs 403 vs 404.** Authentication (who are you?) is 401. Tenancy on
  *reads* is 404 — a valid token probing another tenant's IDs learns nothing
  ([ADR-005](DECISIONS.md)). 403 `not_hired` is reserved for *writes* that
  require an employment relationship, where the employee's existence is
  already public (profiles are listable).
- **409, not 500.** Illegal transitions (cancel a `succeeded` job, claim a
  finished job) are client errors with a clear message, e.g.
  `Job job_1 cannot be cancelled (status "succeeded")`.
- **No stack traces over HTTP.** 500 hides internals. (The detail is
  currently swallowed — structured error logging is on the ROADMAP.)

## 2. Job failure semantics

A job ends in exactly one terminal state. The worker assigns it; the model
never does ([ADR-007](DECISIONS.md)).

```text
queued → claimed → running ─┬─► succeeded     (expectations met)
                            ├─► failed        (error, or expectations checkable-but-unmet)
                            ├─► needs_review  (no automatic verdict possible)
                            └─► cancelled     (cooperative cancel confirmed)
claimed → queued            (stale lease recovered, runs again)
```

| State | When | Who acts next |
|---|---|---|
| `succeeded` | All `--expect-file` / `--expect-contains` checks passed (or no expectations and a clean run) | Nobody — read the report |
| `failed` | Tool error, provider error, invalid model output, or a verifiable expectation unmet (e.g. file missing) | Fix the cause, resubmit |
| `needs_review` | Mission succeeded procedurally but the goal is not automatically verifiable (research brief, email draft…) | A human reads the report and accepts or rejects |
| `cancelled` | `POST /v1/jobs/:id/cancel` confirmed by the worker | Nobody |

Example — distinguishing the three non-success outcomes:

```bash
emp status job_ok       # status: succeeded   report: "wrote notes.md (3 checks passed)"
emp status job_lie      # status: failed      error: "acceptance: expected file HACKED.txt not created"
emp status job_research # status: needs_review  reviewReason: "no automatic check for brief quality"
```

## 3. Retry and recovery

There is **no blind retry**: re-running a job re-runs its side effects, and
the queue is at-least-once ([ADR-006](DECISIONS.md)). Instead:

1. **Crash recovery (automatic).** Every claim carries a heartbeat lease
   (default: stale after 120s without heartbeat). `recoverStaleJobs` —
   run by every worker loop iteration and manually via `emp recover` —
   returns expired claims to `queued`. A job whose worker died is picked up
   by the next live worker; nothing is lost, nothing runs twice
   *concurrently*.
2. **Manual resubmission (operator choice).** `failed` jobs stay `failed`
   with their error attached. The operator inspects (`emp status`),
   fixes the cause, and submits a new mission. Job IDs are never reused,
   so history stays auditable.
3. **Cancel-then-resubmit.** A job stuck in `cancellation_requested`
   (worker dead before confirming) is recovered to `queued` by the lease
   mechanism; cancel again after recovery if still unwanted.

```bash
# After a worker crash: what will be recovered?
emp recover --stale-after-ms 120000
# recovered: job_7 -> queued
# (no stale jobs)          # when there is nothing to do
```

## 4. Logs — where to look

| Signal | Location | Format |
|---|---|---|
| Job history | `$EMPLOYEE_DATA/jobs/<id>.json` | Full record: status, `error`, `report`, `proof`, timestamps |
| Mission record | `$EMPLOYEE_DATA/missions/<id>.json` | Prompt, transcript summary, acceptance checks and results |
| CLI output | stdout of the `emp` invocation, exit code 0/1 | `recovered: job_7 -> queued`, or `Error: <message>` |
| Server / worker stdout | terminal running `emp serve` / `emp worker` | Startup lines only (`listening: …`, `worker started on …`) |

Reading a failure, start to finish:

```bash
# 1. The job record tells the full story
cat $EMPLOYEE_DATA/jobs/job_lie.json | python3 -m json.tool
# { "id": "job_lie", "status": "failed",
#   "error": "acceptance: expected file HACKED.txt not created", ... }

# 2. The mission record shows what the model actually did
cat $EMPLOYEE_DATA/missions/mis_lie.json | python3 -m json.tool
```

> Honest limitation: there is no request log, no worker activity log, and
> no central audit log yet — the job + mission records are the audit trail
> (they are never rewritten, only transitioned forward). Structured logging
> is on the [ROADMAP](ROADMAP.md). Until then, redirect `emp serve` output
> to a file and rely on the records above.

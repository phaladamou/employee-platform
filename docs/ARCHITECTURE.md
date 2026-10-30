# ARCHITECTURE — the technical core

This document explains how the system is layered, what distinguishes an
employee from a work contract, and how a mission flows through the system
end to end.

## The 3 layers

```
┌──────────────────────────────────────────────────────────────┐
│ 3. CLI  core/employee/cli/ + cli.ts                          │
│    Parses argv, builds context, talks to the server.          │
│    The only place that reads process.env (keys, URLs, paths).│
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP REST /v1 + SSE
┌──────────────────────────▼───────────────────────────────────┐
│ 2. Server  core/employee/server/  (+ sdk/)                   │
│    Pure handler (routes + auth) • node:http adapter          │
│    Worker loop (claim -> execute -> settle)                  │
└──────────────────────────┬───────────────────────────────────┘
                           │ direct calls, shared types
┌──────────────────────────▼───────────────────────────────────┐
│ 1. Core  core/employee/                                      │
│    Pure: TypeScript only, no React/Next/Electron imports,    │
│    no env reads, always injected config.                     │
│    Tested in isolation (vitest), runnable without the rest.  │
└──────────────────────────────────────────────────────────────┘
```

**Why this split?** The core holds every business decision (who can do
what, legal transitions, isolation). The API and CLI only transport: same
logic, three doors (in-process, HTTP, terminal). You can swap the
transport without touching the business rules — and test the rules with
no network.

Concretely, `InProcessEmployeeClient` and `HttpEmployeeClient` implement
the **same `EmployeeClient` interface**: recruiting and assigning code
neither knows nor should know whether it talks to local objects or a
remote server.

## Employee vs Employment: don't confuse them

This is the most important distinction in the model.

**Employee — the persistent identity** (`emp_...`)

```ts
{
  id: "emp_9545…",
  name: "Aria",
  role: "Data Analyst",
  skills: ["SQL", "forecasting"],
  status: "idle",
  specialization: { name: "data-analyst", version: "1.0.0" }  // DNA
}
```

The employee exists independently of any employer. Its identity is
permanent, its DNA (specialization + exact version) is immutable: no API
can change it after publishing. That's what makes its reputation
transferable: tomorrow, another employer can recruit *the same*
`emp_9545…` with its verifiable history.

**Employment — the contract** (`hire_...`)

```ts
{
  id: "hire_800a…",
  employeeId: "emp_9545…",
  employerId: "acme",
  hiredAt: "2026-…",
  terminatedAt: null
}
```

The employment is a **separate relation**: it binds an employee to an
employer, for a period. Properties:

- `hire` is **idempotent**: recruiting the same employee twice returns the
  same contract, no duplicates.
- `terminate` ends the contract **without destroying** the employee or its
  history (billing, audit, future references).
- Submitting a mission requires an **active** employment: no contract, no
  work (the server answers 403).

Analogy: the Employee is the person (permanent passport), the Employment
is the work contract (resignable). You never delete the person when the
contract ends.

## Mission lifecycle

A user mission becomes a traceable **job**. States:

```
                    ┌──────────┐
   submit           │  queued  │  waiting, immediately
      └────────────►│          │  cancellable (direct cancel)
                    └────┬─────┘
                         │ atomic claim (a single worker wins)
                    ┌────▼─────┐
                    │ running  │  locked by lockOwner
                    └────┬─────┘
           ┌─────────────┼──────────────┐
           │             │              │ cancel (employer)
      ┌────▼─────┐ ┌─────▼────┐ ┌───────▼──────────────┐
      │succeeded │ │  failed  │ │cancellation_requested│
      │+ report  │ │ + error  │ └──────────┬───────────┘
      └──────────┘ └──────────┘            │ worker stops at the
                                           │ next step, then confirms
                                      ┌────▼─────┐
                                      │cancelled │
                                      └──────────┘
```

Design points:

1. **At-least-once queue.** Claiming goes through a lock file created in
   exclusive mode: across N workers (even on separate processes), a single
   one gets the job. Documented trade-off: a worker dying in `running`
   leaves the job locked (no TTL or heartbeat — manual recovery).
2. **Cooperative cancellation, never brutal.** A running job is never
   killed: the employer requests (`cancellation_requested`), the worker
   observes the signal before each LLM step, stops cleanly, then confirms
   (`cancelled`). A cancelled job is always distinguishable from a failed
   one — including in the employee's memory.
3. **Mission and job are linked but distinct.** The mission carries the
   prompt and the business report; the job carries scheduling (queue,
   lock, cancellation). The worker bridges them: `runClaimedJob` loads
   mission + profile, runs the runtime, persists the result on both sides.
4. **Scoped memory.** Each finished mission is archived under the key
   `(employeeId, employerId)` and recalled to the LLM **only within that
   scope**: experience gained at Acme is never injected into a Globex
   mission (see [SECURITY.md](SECURITY.md)).

Real example (E2E validated with Muse):

```
$ emp submit emp_e7f8… "Create hello.txt with 'bonjour' in it and read it back."
job: job_e8bb… (queued)
$ emp events job_e8bb…
job: job_e8bb… (queued)
job: job_e8bb… (running)
job: job_e8bb… (succeeded)
report: hello.txt created with 'bonjour' (7 bytes written,
        verified by re-read: 'bonjour').
```

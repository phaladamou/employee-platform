# CREATOR vs EMPLOYER — the product vision

There is one fundamental rule in Employee, and the whole system is built
to make it **technically unbreakable**, not just contractual:

> **The Creator defines the DNA. The Employer recruits — never redefines.**

## What the Creator does

The Creator is the trade publisher. Only they can:

- **publish a profile** (`data-analyst@1.0.0`): system prompt, allowed
  tools, permissions, step budget — then **pin its fingerprint** in
  `profiles.lock.json`;
- **publish an employee** by attaching an exact specialization
  (`specialization: {name, version}`) — the DNA, set once, immutable;
- **suspend / reactivate** an employee (a suspended one cannot run).

```bash
# Admin route: "admin" scope required, never granted to employers
emp publish --name Aria --role "Data Analyst" --spec data-analyst@1.0.0
# employee: emp_9545…
```

Publishing is signing: "this employee is a data-analyst v1.0.0, with
exactly these tools and these permissions." That promise travels with the
employee, from one employer to the next.

## What the Employer does

The Employer is the work buyer. They can:

- **recruit** a published employee (`hire` → `hire_...` contract,
  idempotent);
- **assign** in natural language (`submit` → job tracked to its report);
- **follow and cancel** (`status`, real-time `events`, cooperative
  `cancel`);
- **configure the work environment**: the sandbox (reachable data), the
  variables passed to the shell (PATH only by default — the host's API
  keys never leak), *their* scope's memory.

```bash
emp hire emp_9545…
emp submit emp_9545… "Audit churn"
emp events job_e8bb…   # queued -> running -> succeeded + report
```

## What the Employer CANNOT do (enforced by code)

This isn't policy written in Terms of Service — these are errors raised
by the runtime:

| Attempt | Technical barrier |
|---|---|
| Change an employee's profile | no setter: immutable `specialization`, explicit migration only |
| Add a tool to the run | caller tools **ignored** when the employee is bound; resolved from the exact spec |
| Remove a promised tool | same mechanism: the run uses exactly the DNA, no more, no less |
| Raise the step budget | `maxSteps > spec.maxSteps` → error before the 1st LLM call |
| Edit a published profile | specs + lockfile unreachable from employer routes; hash mismatch = refusal |
| Read another tenant's memory | `(employee, employer)` partition + filtering at LLM injection |
| Assign without a contract | `submit` with no active employment → 403 |

## Why this separation?

1. **Transferable trust.** If the employer could redefine DNA, the
   "data-analyst v1.0.0" label would mean nothing — and the employee's
   history would no longer be a credible reference for the *next*
   employer. Immutability founds reputation.
2. **Least privilege by construction.** A shell-less `researcher` stays
   shell-less at every employer: security follows the employee, it doesn't
   depend on each client's discipline.
3. **Clear responsibilities.** Broken trade (bad prompt, bad permission)
   → Creator's fault, fixable by publishing `1.0.1`. Vague mission,
   missing data → Employer's side. The final report always states the
   frame the work was done in.

In one sentence: **the Creator sells guaranteed trades, the Employer buys
framed work — and the system keeps each of them in their role.**

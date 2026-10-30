# SECURITY — the security model

This document describes the three pillars: access keys, profile integrity
(lockfile), and strict isolation between employers.

## 1. Two key families: `emk_` vs `emo_`

The prefix is not cosmetic: it keeps a secret key from ever being confused
with a public identifier (`emp_...`) and separates two authorities.

|  | `emk_` (employee) | `emo_` (employer) |
|---|---|---|
| Bound to | an Employee (`emp_...`) | a tenant (`employerId`) |
| Used to | authenticate the employee itself | call the API as an employer |
| Used by | the runtime / future delegations | CLI, HTTP SDK, integrations |
| Example | `emk_a91F…` | `emo_YVWX…` |

Shared properties (both families):

- **32 random bytes** (`crypto.randomBytes`), base64url-encoded.
- **Hash only at rest** (SHA-256): the cleartext token is shown once, at
  issuance. Stealing the database grants no access.
- **`chmod 600` files**: readable only by the owner.
- **Expiry (TTL)** and **revocation**: a key dies without touching the
  identity it represents. Revoking cuts access, it doesn't delete the
  employee or the employer.
- **Scopes**: `missions:submit`, `missions:read`, `memory:read`,
  `employments:read`, `employments:write`, `admin`. Each route requires
  its scope; a read-only token gets 401 on writes — with the **same
  message** as a nonexistent token (no oracle: neither key existence nor
  the missing scope is revealed).

```bash
$ emp keys issue --employer acme --label prod
id: emcred_e9f1…
token: emo_YVWX…        # shown ONCE, then hashed at rest
scopes: missions:submit,missions:read,…
$ emp keys revoke emcred_e9f1…   # immediate effect
```

## 2. The lockfile: tamper-proof profiles

A profile (`data-analyst@1.0.0`) defines what an employee **may** do:
allowed tools, permissions, system prompt, max reasoning steps. If an
attacker edited `researcher.json` to add `run_shell`, a "shell-less"
employee would execute commands. The lockfile closes that door.

**Mechanism** (`profiles.lock.json`, next to the profiles):

```json
{
  "version": 1,
  "profiles": {
    "data-analyst@1.0.0": "sha256:9f2c…",
    "researcher@1.0.0": "sha256:41ab…"
  }
}
```

At load time, the registry recomputes the SHA-256 fingerprint of each
spec's **canonical content** and compares it against the lockfile:

- spec missing from the lockfile → **hard refusal**;
- content differing by a single byte → **hard refusal**;
- lockfile itself missing or invalid → **hard refusal**.

The Creator regenerates the lockfile via `createProfileLockfile` when
publishing a new version — never the Employer, who has no route touching
specs.

**Assumed limits** (documented, not hidden):

- The lockfile guards against **accidents and modification** (bad edits,
  disk corruption), not against an attacker who can already write the
  lockfile itself: they would re-pin their own hashes. The planned
  countermeasure (Creator Ed25519 signatures) is reserved for remote
  distribution.
- `verify: false` exists for local development only — never in production.

## 3. Strict isolation: `employerId` everywhere, leaking nowhere

Golden rule: **the tenant is derived from the verified token, never from
the body or the URL.** No caller can claim "act for Acme": its key proves
it, and the server derives `employerId` from that proof.

Concretely, on every sensitive read:

```ts
// Pseudo-code of the pattern applied to jobs, missions, employments…
const job = await jobs.loadScoped(tokenEmployerId, jobId);
if (!job) return 404;   // unknown OR foreign: same answer
```

- **Indistinguishable 404**: requesting another employer's job answers
  exactly like a nonexistent job. No existence leak, no enumeration.
- **Always-scoped listings**: `listByEmployer` sees a single tenant. Only
  the infra worker (never exposed to clients) scans across tenants via
  `claimNext`.
- **Partitioned memory**: `employee_<id>/employer_<e>.json` files, and
  above all **filtering at injection time** — the cross-employer test
  proves Acme history never appears in a Globex mission's system prompt.
  (Pre-scope archives with `employerId: null`: readable everywhere,
  documented legacy case.)
- **Guarded submission**: `submit` requires an active employment *between
  that employee and that tenant*, else 403.

What the tests verify (not just claim):

- a second client (another employer, same stores) gets `null`/`404` on
  status, mission, cancel, events, listings;
- a foreign job's event stream is refused before the first byte;
- a revoked or expired token dies immediately, with a 401 identical to a
  nonexistent token.

## Deliberately out of scope

- Encryption at rest beyond file permissions (left to the host's encrypted
  volume).
- API rate limiting (structure ready on the web OTP throttling side, not
  yet on `/v1`).
- Access audit log (stores version `createdAt`/transitions, not reads).

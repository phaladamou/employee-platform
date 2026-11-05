# PROFILES — the skills catalog

A profile is a **versioned trade**: it defines what an employee can do,
with which tools, under which permissions, with how many reasoning
steps at most, and on which kind of machine. The profile is the DNA;
the employee is a living instance of it.

## Anatomy of a versioned profile

`atlas-software-engineer@1.0.0`
(`core/employee/profiles/atlas-software-engineer.json`):

```json
{
  "name": "atlas-software-engineer",
  "version": "1.0.0",
  "role": "Software Engineer",
  "systemPrompt": "Forged by Cofoundator. Writes production-ready code…",
  "allowedTools": ["read_file", "write_file", "run_shell"],
  "permissions": ["fs:read", "fs:write", "shell:exec"],
  "maxSteps": 16,
  "environment": ["python3", "pip", "pytest", "git"],
  "computer": {
    "binaries": ["python3", "pip", "pytest", "ls", "cat", "echo"],
    "networkAccess": false
  }
}
```

Every field has an execution role, not a decorative one:

| Field | Role |
|---|---|
| `name` + `version` | exact identity, pinned in the lockfile and in the employee DNA |
| `role`, `systemPrompt` | business context injected into the LLM (framed, never overriding runtime rules) |
| `allowedTools` | resolvable tools for this profile — any other tool is rejected |
| `permissions` | rights required from each tool (`fs:read`, `fs:write`, `shell:exec`) |
| `maxSteps` | LLM step budget; a run may ask for *fewer*, never more |
| `environment` | prerequisite binaries checked on `PATH` before the first LLM call — a missing one refuses the mission (fail fast, no token spent) |
| `computer.binaries` | shell allowlist enforced by `run_shell`: every `&&`/`;`/`|` segment's first-level binary must be listed. `ls`, `cat`, `echo` form the inspection base present in every profile |
| `computer.networkAccess` | declared intent only — not enforced yet (no netns/seccomp); documented as such, never relied upon |

**Strict versioning**: the employee is bound to `name@exact-version`,
never to "latest". Publishing `atlas-software-engineer@1.1.0` changes
nothing for employees bound to `1.0.0` — guaranteed reproducibility.
Changing DNA goes through an explicit migration (new object, same `id`),
never a silent mutation.

## The current catalog (6 profiles)

Shipped in `core/employee/profiles/`, integrity-pinned in
`profiles.lock.json` (SHA-256 of canonical content, verified at load).
Three legacy profiles (`data-analyst`, `researcher`,
`software-engineer` — pre-catalog schema, no `environment`/`computer`
block) remain in the directory and in the lockfile for backward
compatibility; the supported catalog is the six below:

### Engineering

- `atlas-software-engineer@1.0.0` — Software Engineer. Tools:
  `read_file`, `write_file`, `run_shell`, `github_fork`,
  `github_clone`, `github_create_issue`, `github_create_pr`,
  `github_push`. Environment: `python3`, `pip`, `pytest`, `git`.
  32 steps. Implements, tests, verifies — including on GitHub
  (see [GITHUB_E2E.md](GITHUB_E2E.md)).
- `nova-devops-engineer@1.0.0` — DevOps Engineer. Tools: `run_shell`,
  `read_file` (no `write_file` — least privilege). Binaries:
  `docker`, `git` (+ inspection base). 12 steps. Pipelines and
  immutable environments.

### Research & Data

- `aria-data-analyst@1.0.0` — Data Analyst. Tools: `read_file`,
  `write_file` (no shell). Binaries: `python3`, `sqlite3`
  (+ inspection base). 12 steps. Structured reports, never alters
  source files.
- `newton-researcher@1.0.0` — Researcher. Tools: `read_file`,
  `write_file` (no shell). No environment prerequisites. 10 steps.
  Briefs that separate measured facts from inferences.

### Operations

- `milo-content-strategist@1.0.0` — Content Strategist. Tools:
  `read_file`, `write_file` (no shell). 10 steps. Documentation
  and readability.
- `sana-seo-analyst@1.0.0` — SEO Analyst. Tools: `read_file`,
  `write_file` (no shell). 10 steps. Search intent and page
  structure, without touching production code.

All six carry the inspection base (`ls`, `cat`, `echo`) in
`computer.binaries`, pinned by `profiles/catalog.test.ts`. Profiles
without `run_shell` still declare a `computer` block: it documents the
machine the employee would get if it ever earned shell access, and
keeps the schema uniform.

## Fail Fast: how the runtime enforces permissions

At the start of every run — **before the first LLM call** — the runtime
resolves tools via `resolveToolsForProfile`:

```
bound employee? ── no ──► generalist behavior (provided tools)
    │
    yes: resolve "exact name@version" from the registry
    │
    ├─ unknown spec ───────────────► ERROR (no run)
    ├─ unknown profile tool ───────► ERROR (no run)
    ├─ tool missing the permission ─► ERROR (no run)
    ├─ requested maxSteps > budget ─► ERROR (no run)
    ├─ environment prerequisite ───► ERROR (no run)
    │   missing from PATH
    │
    └─ all clear ──► run with EXACTLY these tools
         (caller-provided tools are ignored:
          an employer can neither omit nor substitute the DNA)
```

Concrete example: an employee bound to `newton-researcher@1.0.0`
receives the mission "run the tests with `npm test`". The runtime
resolves `[read_file, write_file]`, `run_shell` is never resolved, the
LLM doesn't even see it in its catalog — and if it still attempts
`ACTION: run_shell`, the loop answers `unknown tool` as an observation.
The ban is structural, not an instruction the model could ignore.

That's the meaning of **Fail Fast** (the validated option, against the
"silently degrade" alternative): any gap between the promised DNA and the
real environment raises frankly, before spending a single token — rather
than letting an employee work with means it was never promised.

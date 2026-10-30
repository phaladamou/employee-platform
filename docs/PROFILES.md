# PROFILES — the skills catalog

A profile is a **versioned trade**: it defines what an employee can do,
with which tools, under which permissions, and with how many reasoning
steps at most. The profile is the DNA; the employee is a living instance
of it.

## Anatomy of a versioned profile

`data-analyst@1.0.0` (`core/employee/profiles/data-analyst.json`):

```json
{
  "name": "data-analyst",
  "version": "1.0.0",
  "role": "Data Analyst",
  "systemPrompt": "You are a senior data analyst. Explore datasets…",
  "allowedTools": ["read_file", "write_file", "run_shell"],
  "permissions": ["fs:read", "fs:write", "shell:exec"],
  "maxSteps": 12
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

**Strict versioning**: the employee is bound to `name@exact-version`,
never to "latest". Publishing `data-analyst@1.1.0` changes nothing for
employees bound to `1.0.0` — guaranteed reproducibility. Changing DNA
goes through an explicit migration (new object, same `id`), never a
silent mutation.

## The current catalog (3 profiles)

### data-analyst@1.0.0 — the complete analyst

- Tools: `read_file`, `write_file`, `run_shell`
- Permissions: `fs:read`, `fs:write`, `shell:exec`
- Budget: 12 steps
- Use: explore datasets, compute, produce figures grounded in tool
  observations (never invented — written into its system prompt).

### researcher@1.0.0 — the researcher with no shell

- Tools: `read_file`, `write_file` (**no `run_shell`**)
- Permissions: `fs:read`, `fs:write`
- Budget: 10 steps
- Use: read, synthesize, cite sources by file path. This is the
  least-privilege showcase profile: even if the mission asks, it cannot
  execute commands.

### software-engineer@1.0.0 — the pragmatic engineer

- Tools: `read_file`, `write_file`, `run_shell`
- Permissions: `fs:read`, `fs:write`, `shell:exec`
- Budget: 16 steps (the widest — implementing + verifying takes steps)
- Use: implement what the mission asks, run checks through the tools,
  only report done after self-verification.

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
    │
    └─ all clear ──► run with EXACTLY these tools
         (caller-provided tools are ignored:
          an employer can neither omit nor substitute the DNA)
```

Concrete example: an employee bound to `researcher@1.0.0` receives the
mission "run the tests with `npm test`". The runtime resolves
`[read_file, write_file]`, `run_shell` is never resolved, the LLM doesn't
even see it in its catalog — and if it still attempts `ACTION: run_shell`,
the loop answers `unknown tool` as an observation. The ban is structural,
not an instruction the model could ignore.

That's the meaning of **Fail Fast** (the validated option, against the
"silently degrade" alternative): any gap between the promised DNA and the
real environment raises frankly, before spending a single token — rather
than letting an employee work with means it was never promised.

# Atlas GitHub E2E — runbook

Proves Atlas can work on GitHub end to end with a real LLM: fork →
clone → edit → push → PR on a disposable TEST fork, verified
independently through the GitHub API (never by trusting the LLM).

## Harness

`/tmp/atlas-github-e2e.mts` (throwaway driver, kept out of the repo —
same convention as the T6 replay recipe in TESTING.md):

```bash
npx tsx --env-file=.env.local /tmp/atlas-github-e2e.mts [upstream-owner/name]
# default upstream: octocat/Hello-World
```

The mission mirrors `runWebMission` exactly (same runtime, same
stores, `atlas-software-engineer@1.0.0`). Independent checks at the
end: `fork-exists`, `pr-found`, `readme-line`, `upstream-clean`
(no issues/PRs created on the upstream by the test account).
`ATLAS_GITHUB_E2E:PASS` requires a completed mission AND every check
green. The fork and PR are left open for the demo — close them and
delete the fork afterwards.

## Preconditions (all three, no exceptions)

1. **The fork must NOT exist.** The harness refuses to run if
   `<you>/<repo>` already exists (a stale fork would fake
   `fork-exists`). Delete it first: `gh repo delete <you>/<repo>
   --yes` or the web UI.
2. **A token that can fork.** `GITHUB_TOKEN` must be a classic PAT
   with the `repo` scope (deleting the fork needs `delete_repo`).
   The `ghu_*` GitHub-App user token from the OAuth login CANNOT
   fork or delete: every call fails with `403 Resource not
   accessible by integration` — that message means you are running
   with the wrong token.
3. **Export the token in the running shell.**
   `node --env-file` never overrides an exported variable — and
   nothing exports it for you: `export GITHUB_TOKEN=<classic-pat>`
   before the run, in the same terminal. `MUSE_API_KEY` /
   `EMPLOYEE_PROVIDER=muse` come from `.env.local` as usual.

## Debugging a failed run

The harness prints `inspect: data=… workspaces=…` and keeps both
directories. `<workspace>/atlas-e2e/.employee-activity.log` is the
step-by-step record of every `github_*` tool call (start + failure
lines, token scrubbed); the clone next to it shows exactly what
landed on disk. The `fork-exists` / `pr-found` URLs in the output
link the real GitHub state.

## Incident history (2026-11-03, all fixed and regression-tested)

| Run | Symptom | Root cause |
|---|---|---|
| 16:34 | `FATAL: FetchLLMProvider requires an apiKey` | Harness never loaded `.env.local`. Fix: `--env-file=.env.local`. |
| 16:37 | `FATAL: Mission looks like file creation` | `create` inside `github_create_issue` + `README file` tripped the acceptance guard. Fix: `isGithubMission()` exemption in `mission-intent.ts` (ADR-016). |
| 16:47 | Fork `403` | `ghu_*` token. Fix: classic PAT in the shell (see Preconditions). |
| 16:58 | `failed after 16 steps`, issue missing | Step budget too small for 6 steps + retries. Fix: Atlas `maxSteps` 16 → 32 (lockfile regenerated via `createProfileLockfile`); issue step dropped from the demo (fork/edit/PR is the signal). |
| 17:08 | `failed after 32 steps`, nothing pushed | `github_push` bugs: token re-injected over the already-authed `origin` (`URL rejected: Port number…`), then an "already clean" early-return reported success without pushing. Fix: idempotent `authedRemoteUrl` + always push. |
| 17:27 | Fork `403` again | New terminal without the exported token (fell back to `ghu_*`). Not a code bug. |
| 17:36 | **ATLAS_GITHUB_E2E:PASS** | Fork + PR + README line verified, upstream untouched. |

## Cost note

One full run costs ~10–15 Muse calls (more when the agent
retries). Keep the demo scope small; raise `maxSteps` only with
evidence the agent was productive, not looping — a bigger budget
feeds loops.

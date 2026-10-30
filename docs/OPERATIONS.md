# Operations Guide — EmployeeCore

Day-to-day exploitation: starting the server, scaling workers, backups,
stuck-job recovery, and key revocation.

Prerequisite: a runnable CLI copy (see `core/employee/README.md`):

```bash
rm -rf .tmp/emp && mkdir -p .tmp/emp && cp -r core/employee/* .tmp/emp/
cd .tmp/emp && find . -name "*.ts" \
  -exec perl -pi -e 's/from "(\.\.?\/[^"]+?)(?<!\.ts)"/from "$1.ts"/g' {} +
alias emp="node --experimental-transform-types --no-warnings cli.ts"
```

Environment used below:

| Variable | Default | Purpose |
|---|---|---|
| `EMPLOYEE_DATA` | `.data/employee` | All state: credentials, jobs, missions, memory |
| `EMPLOYEE_SANDBOX` | `.data/workspace` | Files tools may read/write (per-profile subdirs) |
| `EMPLOYEE_PROFILES` | `core/employee/profiles` | Profile registry + lockfile |
| `EMPLOYEE_API_URL` | `http://127.0.0.1:8000` | Where the CLI talks to the server |
| `EMPLOYEE_TOKEN` | — | `emo_…` token for hire/submit/status/… |
| `EMPLOYEE_PROVIDER` | `deepseek` | `deepseek` or `muse` (+ `DEEPSEEK_API_KEY` / `MUSE_API_KEY`) |

## 1. Start the server — `emp serve`

```bash
export EMPLOYEE_DATA=/var/lib/employee
export EMPLOYEE_PROVIDER=muse MUSE_API_KEY=...
emp serve --port 8000
# listening: http://127.0.0.1:8000
```

- Boot verifies the profile lockfile: a tampered profile refuses to load
  and the server exits instead of running unknown behavior.
- `serve` starts **one embedded worker** by default. No provider key →
  startup fails fast with `no LLM provider configured`.
- Graceful shutdown: `SIGINT`/`SIGTERM` stops the worker loop, then closes
  the HTTP server. In-flight jobs keep their claim; on restart their lease
  expires and they are recovered (§4).

## 2. Scale workers — `emp worker`

N workers can share one `$EMPLOYEE_DATA` (claims are atomic). Run extras on
the same machine or any host with the data dir mounted:

```bash
# worker 2 and 3, each with a stable id (visible as lockOwner)
emp worker --id worker_2 &
emp worker --id worker_3 --interval-ms 2000 &
# worker started on /var/lib/employee (Ctrl-C to stop)
```

- `--interval-ms`: poll interval between queue scans (default 250ms;
  lower it for latency, raise it for disk calm).
- A worker needs the same `EMPLOYEE_PROVIDER` key and `EMPLOYEE_SANDBOX` as
  the server. It needs no network port.
- Stop with `SIGINT`/`SIGTERM`. Never `kill -9` a worker mid-tool-call if
  avoidable — the lease mechanism will recover the job, but a duplicate
  execution becomes likely (at-least-once).

## 3. Back up — copy `.data/`

State is plain files; backup is a filesystem copy. Layout:

```text
$EMPLOYEE_DATA/            # e.g. /var/lib/employee
├── credentials/           # key hashes (chmod 600) — NEVER world-readable
├── employments/
├── jobs/
├── missions/
├── profiles/             # hired employee instances
└── memory/
$EMPLOYEE_SANDBOX/         # e.g. .data/workspace — tool-visible files
```

```bash
# Online backup (writes are atomic renames; a copy is always consistent enough
# to boot — at worst one in-flight job is recovered on restore)
tar -czf employee-backup-$(date +%F).tar.gz -C /var/lib employee workspace

# Restore
tar -xzf employee-backup-2026-10-30.tar.gz -C /var/lib
emp recover   # re-queue anything whose worker died with the old host
```

Back up `credentials/` with restricted permissions (`chmod 600` on restore)
and keep operator Ed25519 keys wherever your secrets live — they are not
in `$EMPLOYEE_DATA`.

## 4. Recover a stuck job — `emp recover`

A job is *stuck* when its worker died without finishing (crash, `kill -9`,
host loss). The lease makes this self-healing: any live worker's loop
iteration re-queues expired claims automatically. `emp recover` is the
manual trigger (and the post-restore step):

```bash
emp recover                          # default: stale after 120s
emp recover --stale-after-ms 30000   # faster, e.g. right after a known crash
# recovered: job_7 -> queued
# (no stale jobs)
```

Safety rules:

- Never lower the threshold below your longest normal tool call — a slow
  (not dead) worker would lose its claim and the job would run twice.
- `recover` only touches claims whose heartbeat expired; live workers are
  never interrupted.
- A job that keeps failing after recovery is not stuck — read
  `$EMPLOYEE_DATA/jobs/<id>.json` (`error` field) instead of recovering
  again. See [ERROR_HANDLING.md](ERROR_HANDLING.md).

## 5. Revoke a key — `emp keys revoke`

```bash
# List keys for an employer (ids + labels, never secrets)
emp keys list --employer acme
# cred_1  prod      scopes: hire,submit,read
# cred_2  ci        scopes: submit,read

# Revoke by credential id — immediate, all processes (file-backed)
emp keys revoke cred_2
# revoked: cred_2
```

- Revocation deletes the credential file: subsequent requests with that
  token get `401 unauthorized`. No restart, no cache flush.
- Compromised admin/creator key: revoke it, issue a new one, and rotate any
  employer keys it issued if the exposure window is unknown.
- Prefer short `--ttl-ms` for CI/automation keys so revocation is the
  exception, not the routine.

## 6. Quick health check

```bash
# 1. API alive?
curl -s -o /dev/null -w "%{http_code}\n" $EMPLOYEE_API_URL/v1/employees
# 401 = alive (auth required); connection refused = server down

# 2. Queue draining? (needs EMPLOYEE_TOKEN)
emp status job_latest   # recent jobs reaching terminal states?

# 3. Anything stuck?
emp recover             # expect "(no stale jobs)" on a healthy system
```

## 7. Run in Docker (isolated)

Same API + worker as a least-privilege container (see ADR-011).
One image, two roles — extra workers just override `CMD`:

```bash
docker build -t employee-core .

# API + embedded worker, read-only root FS, capped resources
docker run -d --name emp \
  --read-only --tmpfs /tmp:uid=1000,gid=1000 \
  -v emp-data:/data -v emp-sandbox:/sandbox \
  -m 512m --cpus=1.0 -p 8000:8000 \
  -e EMPLOYEE_PROVIDER=muse -e MUSE_API_KEY=... \
  employee-core serve --port 8000

# Second worker on the same data dir (atomic claims)
docker run -d --name emp-w2 \
  --read-only --tmpfs /tmp \
  -v emp-data:/data -v emp-sandbox:/sandbox \
  -m 512m --cpus=1.0 \
  -e EMPLOYEE_PROVIDER=muse -e MUSE_API_KEY=... \
  employee-core worker --id worker_docker_2
```

Notes:

- The container runs as `node` (uid 1000, non-root); only `/tmp`,
  `/data` and `/sandbox` are writable.
- Back up the named volumes (`emp-data`, `emp-sandbox`) exactly like
  §3 (`tar` the volume contents).
- `emp recover` / `keys revoke` work unchanged — run them in a
  throwaway container on the same volumes, e.g.
  `docker run --rm -v emp-data:/data … employee-core recover`.

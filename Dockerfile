# EmployeeCore API + worker (production image).
#
# Build:   docker build -t employee-core .
# Run API: docker run -d --name emp \
#            --read-only --tmpfs /tmp:uid=1000,gid=1000 \
#            -v emp-data:/data -v emp-sandbox:/sandbox \
#            -v emp-workspaces:/workspaces \
#            -m 512m --cpus=1.0 -p 8000:8000 \
#            -e EMPLOYEE_PROVIDER=muse -e MUSE_API_KEY=... \
#            employee-core serve --port 8000 --host 0.0.0.0
# Extra worker (same data dir):
#          docker run -d --name emp-w2 --read-only --tmpfs /tmp \
#            -v emp-data:/data -v emp-sandbox:/sandbox \
#            -v emp-workspaces:/workspaces \
#            -m 512m --cpus=1.0 \
#            -e EMPLOYEE_PROVIDER=muse -e MUSE_API_KEY=... \
#            employee-core worker --id worker_docker_2
#
# Isolation properties (see ADR-011, ADR-014, ADR-015):
# - non-root user (node, uid 1000), no privilege escalation path;
# - read-only root filesystem: only /tmp (tmpfs) and the /data +
#   /sandbox + /workspaces volumes are writable;
# - emp-sandbox baked in: every run_shell is Landlock-confined to its
#   employee workspace (read-write) plus a read-only system view;
# - hard resource envelope enforced by the run flags above
#   (512 MiB RAM, 1 CPU) — the image itself carries no limit knobs,
#   the orchestrator does.

# Stage 1: strict shell backend (Rust). Debian-based so the glibc
# binary runs on the slim runtime below.
FROM rust:1-bookworm AS sandbox-build
WORKDIR /build
COPY rust/Cargo.toml rust/Cargo.lock ./
COPY rust/src ./src
RUN cargo build --locked --release --bin emp-sandbox

FROM node:22-slim

LABEL org.opencontainers.image.title="employee-core" \
      org.opencontainers.image.description="EmployeeCore async worker API + job worker" \
      org.opencontainers.image.source="https://github.com/phaladamou/employee-platform"

# The core is dependency-free except dotenv (CLI .env.local support).
WORKDIR /app
RUN npm init -y >/dev/null 2>&1 \
  && npm install --omit=dev --no-audit --no-fund dotenv@16.4.5 \
  && npm cache clean --force \
  && rm package.json package-lock.json

# Atlas toolchain: the atlas-software-engineer profile declares
# environment ["python3", "pip", "pytest", "git"] and the runtime
# refuses its missions when these binaries are missing. All land
# under /usr (covered by the Landlock read-only system view).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip git \
  && pip3 install --no-cache-dir --break-system-packages pytest \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists

# Runnable .ts copy: extensionless relative imports gain their `.ts`
# suffix (same transform as core/employee/README.md, via node since
# the slim image ships no perl).
COPY core/employee ./core-src/
RUN mkdir -p /app/emp \
  && cp -r /app/core-src/* /app/emp/ \
  && rm -rf /app/core-src \
  && node -e "const fs=require('fs'),path=require('path');const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name);return e.isDirectory()?walk(p):(p.endsWith('.ts')?[p]:[]);});for(const f of walk('/app/emp')){const s=fs.readFileSync(f,'utf8');const n=s.replace(/from \"(\.\.?\/[^\"]+?)(?<!\.ts)\"/g,'from \"\$1.ts\"');if(n!==s)fs.writeFileSync(f,n);}" \
  && node --experimental-transform-types --no-warnings /app/emp/cli.ts 2>&1 | grep -q "Usage: cli.ts"

# Strict shell backend (Landlock confinement, ADR-015).
COPY --from=sandbox-build /build/target/release/emp-sandbox /usr/local/bin/emp-sandbox

# Writable state lives ONLY here (mount volumes over all three).
RUN mkdir -p /data /sandbox /workspaces && chown -R node:node /data /sandbox /workspaces /app
ENV EMPLOYEE_DATA=/data \
  EMPLOYEE_SANDBOX=/sandbox \
  EMPLOYEE_WORKSPACES_DIR=/workspaces \
  EMPLOYEE_PROFILES=/app/emp/profiles \
  EMPLOYEE_API_URL=http://127.0.0.1:8000 \
  EMPLOYEE_SANDBOX_BIN=/usr/local/bin/emp-sandbox \
  NODE_ENV=production
VOLUME ["/data", "/sandbox", "/workspaces"]
EXPOSE 8000

USER node
WORKDIR /app/emp

# 401 = alive and demanding auth (same probe as docs/OPERATIONS.md).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8000/v1/employees').then(r=>process.exit(r.status===401?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["node", "--experimental-transform-types", "--no-warnings", "/app/emp/cli.ts"]
# Bind 0.0.0.0: with the 127.0.0.1 default the port mapping would stay
# unreachable from outside the container (cloud health checks fail).
# --port wins over PORT; without either, serve listens on 8000.
CMD ["serve", "--port", "8000", "--host", "0.0.0.0"]

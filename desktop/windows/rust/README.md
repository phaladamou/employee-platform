# employee-native (Rust)

Security-critical modules for the employee platform. TypeScript stays
the core language; Rust covers exactly two modules where memory safety
and audited crypto matter most (ADR-010).

## Layout

```text
rust/
├── Cargo.toml          # crate employee-native (cdylib + rlib)
├── Cargo.lock          # pinned deps (reproducible builds)
├── build.sh            # -> core/employee/wasm/dist/*.wasm (committed, --lib)
├── src/
│   ├── lib.rs          # modules + cfg gates
│   ├── crypto.rs       # Ed25519 keygen/sign/verify (WASM + native)
│   ├── sandbox.rs      # strict subprocess sandbox (NATIVE ONLY)
│   ├── fs_confinement.rs  # Landlock FS policy (LINUX ONLY, no-op elsewhere)
│   ├── wasm_api.rs     # minimal C ABI (alloc/free + ed_*)
│   └── bin/
│       └── emp-sandbox.rs  # strict shell runner, JSON report
└── tests/
    └── fs_confinement.rs   # full-chain Landlock proof via the binary
```
../core/employee/wasm/
├── wrapper.ts          # Node loader + typed Ed25519 API (sync + async)
├── wrapper.test.ts     # interop: Rust <-> Node byte-identical
└── dist/               # built WASM (tests run without a toolchain)
```

## Why the split

- `crypto` is pure bytes-in/bytes-out: it compiles to
  `wasm32-unknown-unknown` with no OS dependencies (entropy comes from
  the host seed). Mission proofs sign/verify through it first, with a
  Node fallback (same bytes — Ed25519 is deterministic).
- `sandbox` spawns real processes: impossible in WASM by construction,
  so it is `#[cfg(not(target_arch = "wasm32"))]`. The `emp-sandbox`
  binary exposes it over a JSON protocol; `run_shell` bridges to it
  when `EMPLOYEE_SANDBOX_BIN` is set (ENOENT-only fallback, everything
  else fails closed).
- `fs_confinement` (ADR-015) restricts the sandboxed child to its
  workspace (read-write) plus a minimal read-only system view, via
  Landlock in a `pre_exec` hook — raw syscalls over the existing
  `libc`, zero new dependencies. Policy frozen in the parent
  (canonical path + ABI mask), applied allocation-free in the child;
  missing Landlock or an ABI newer than v8 refuses the spawn
  (fail-closed). No-op on non-Linux Unix.

## Commands

```bash
cargo test --locked                        # 27 tests (17 lib + 3 binary + 7 Landlock)
cargo build --locked --release --target wasm32-unknown-unknown --lib
./build.sh                                 # rebuild + refresh dist/ (--lib only:
                                           # emp-sandbox is native-only)
cargo build --locked --release --bin emp-sandbox   # strict backend
./target/release/emp-sandbox --timeout-ms 5000 --max-output-bytes 200000 \
  --work-dir /tmp -- /bin/echo hello
```

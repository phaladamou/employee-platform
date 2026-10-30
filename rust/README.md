# employee-native (Rust)

Security-critical modules for the employee platform. TypeScript stays
the core language; Rust covers exactly two modules where memory safety
and audited crypto matter most (ADR-010).

## Layout

```text
rust/
├── Cargo.toml          # crate employee-native (cdylib + rlib)
├── Cargo.lock          # pinned deps (reproducible builds)
├── build.sh            # -> dist/employee_native.wasm (committed)
├── dist/               # built WASM (tests run without a toolchain)
├── src/
│   ├── lib.rs          # modules + cfg gates
│   ├── crypto.rs       # Ed25519 keygen/sign/verify (WASM + native)
│   ├── sandbox.rs      # strict subprocess sandbox (NATIVE ONLY)
│   └── wasm_api.rs     # minimal C ABI (alloc/free + ed_*)
└── ts/
    ├── wrapper.ts      # Node loader + typed Ed25519 API
    └── wrapper.test.ts # interop: Rust <-> Node byte-identical
```

## Why the split

- `crypto` is pure bytes-in/bytes-out: it compiles to
  `wasm32-unknown-unknown` with no OS dependencies (entropy comes from
  the host seed).
- `sandbox` spawns real processes: impossible in WASM by construction,
  so it is `#[cfg(not(target_arch = "wasm32"))]`. Use it from native
  hosts or from inside the Docker image's future hardening.

## Commands

```bash
cargo test                                   # 11 tests, native
cargo build --release --target wasm32-unknown-unknown
./build.sh                                   # rebuild + refresh dist/
```

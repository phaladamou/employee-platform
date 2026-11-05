#!/usr/bin/env bash
# Build the WASM crypto module into core/employee/wasm/dist/ (committed
# artifact so the TypeScript wrapper tests run without a Rust toolchain).
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v cargo >/dev/null 2>&1; then
  echo "error: cargo not found (https://rustup.rs)" >&2
  exit 1
fi

# --lib only: emp-sandbox is native-only (processes cannot exist in
# WASM) and must not be built for this target.
cargo build --locked --release --target wasm32-unknown-unknown --lib
mkdir -p ../core/employee/wasm/dist
cp target/wasm32-unknown-unknown/release/employee_native.wasm ../core/employee/wasm/dist/
ls -la ../core/employee/wasm/dist/employee_native.wasm

#!/usr/bin/env bash
# Build the WASM crypto module into rust/dist/ (committed artifact so
# the TypeScript wrapper tests run without a Rust toolchain).
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v cargo >/dev/null 2>&1; then
  echo "error: cargo not found (https://rustup.rs)" >&2
  exit 1
fi

cargo build --locked --release --target wasm32-unknown-unknown
mkdir -p dist
cp target/wasm32-unknown-unknown/release/employee_native.wasm dist/
ls -la dist/employee_native.wasm

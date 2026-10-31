//! Native security modules for the employee platform.
//!
//! - [`crypto`]: Ed25519 keygen/sign/verify over raw bytes.
//!   Builds everywhere, including `wasm32-unknown-unknown`.
//! - [`sandbox`]: strict subprocess sandbox (timeouts, output caps,
//!   Unix rlimits). Native only: processes cannot exist in WASM, so
//!   the module is compiled out on `wasm32` (see `cfg` below).
//! - [`fs_confinement`]: Landlock filesystem confinement (Linux).
//!   Writable workspace + read-only system view for sandboxed shells;
//!   no-op on non-Linux Unix, absent on `wasm32`.
//! - [`wasm_api`]: minimal C ABI for the WASM build (`emp_alloc`,
//!   `emp_free`, `ed_*`). No wasm-bindgen CLI needed: the TypeScript
//!   wrapper (`rust/ts/wrapper.ts`) drives linear memory directly.

pub mod crypto;

#[cfg(all(unix, not(target_arch = "wasm32")))]
pub mod fs_confinement;

#[cfg(not(target_arch = "wasm32"))]
pub mod sandbox;

#[cfg(target_arch = "wasm32")]
pub mod wasm_api;

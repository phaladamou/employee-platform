//! Minimal C ABI for the WASM build. Conventions (mirrored by the
//! TypeScript wrapper, which is the only supported caller):
//!
//! - `emp_alloc(len)` / `emp_free(ptr, len)` manage linear memory.
//! - `ed_*` functions take raw pointers + explicit lengths and return
//!   a status code: `0` ok, `1` invalid signature (verify only),
//!   negative = caller error (null pointer). They never trap on
//!   well-formed calls and never expose panics.
//! - Fixed sizes: seed/secret/public 32 bytes, signature 64 bytes,
//!   keypair blob 64 bytes (`secret || public`).

use crate::crypto;
use std::slice;

pub const STATUS_OK: i32 = 0;
pub const STATUS_INVALID: i32 = 1;
pub const STATUS_BAD_PTR: i32 = -1;

/// Allocate `len` uninitialized bytes, owned by the caller via `emp_free`.
#[no_mangle]
pub extern "C" fn emp_alloc(len: usize) -> *mut u8 {
    let mut buffer = Vec::with_capacity(len);
    let ptr = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    ptr
}

/// Release a buffer from `emp_alloc`. `len` must be the same value.
#[no_mangle]
pub extern "C" fn emp_free(ptr: *mut u8, len: usize) {
    if ptr.is_null() {
        return;
    }
    // SAFETY: ptr/len come from `emp_alloc` (documented contract);
    // Vec::from_raw_parts with len 0..=cap is sound, then dropped.
    unsafe {
        let _ = Vec::from_raw_parts(ptr, 0, len);
    }
}

fn read_bytes<'a>(ptr: *const u8, len: usize) -> Option<&'a [u8]> {
    if ptr.is_null() {
        return None;
    }
    // SAFETY: the wrapper only passes pointers it wrote through the
    // exported memory within one call; bounds trusted by contract.
    Some(unsafe { slice::from_raw_parts(ptr, len) })
}

fn write_bytes(ptr: *mut u8, data: &[u8]) -> bool {
    if ptr.is_null() {
        return false;
    }
    // SAFETY: same contract as `read_bytes`; the wrapper allocates
    // exactly `data.len()` bytes for every out-pointer.
    unsafe {
        std::ptr::copy_nonoverlapping(data.as_ptr(), ptr, data.len());
    }
    true
}

/// `out64 = secret || public` derived from `seed32`.
#[no_mangle]
pub extern "C" fn ed_keypair_from_seed(seed32: *const u8, out64: *mut u8) -> i32 {
    let seed = match read_bytes(seed32, crypto::SEED_LEN) {
        Some(bytes) => bytes,
        None => return STATUS_BAD_PTR,
    };
    let seed: &[u8; 32] = match seed.try_into() {
        Ok(fixed) => fixed,
        Err(_) => return STATUS_BAD_PTR,
    };
    let (secret, public) = crypto::keypair_from_seed(seed);
    let mut blob = [0u8; 64];
    blob[..32].copy_from_slice(&secret);
    blob[32..].copy_from_slice(&public);
    if write_bytes(out64, &blob) {
        STATUS_OK
    } else {
        STATUS_BAD_PTR
    }
}

/// `out64 = sign(secret32, msg)`.
#[no_mangle]
pub extern "C" fn ed_sign(
    secret32: *const u8,
    msg: *const u8,
    msg_len: usize,
    out64: *mut u8,
) -> i32 {
    let (secret, message) = match (read_bytes(secret32, crypto::SECRET_LEN), read_bytes(msg, msg_len)) {
        (Some(secret), Some(message)) => (secret, message),
        _ => return STATUS_BAD_PTR,
    };
    let secret: &[u8; 32] = match secret.try_into() {
        Ok(fixed) => fixed,
        Err(_) => return STATUS_BAD_PTR,
    };
    let signature = crypto::sign(secret, message);
    if write_bytes(out64, &signature) {
        STATUS_OK
    } else {
        STATUS_BAD_PTR
    }
}

/// Returns `STATUS_OK` when valid, `STATUS_INVALID` otherwise.
#[no_mangle]
pub extern "C" fn ed_verify(
    public32: *const u8,
    msg: *const u8,
    msg_len: usize,
    sig64: *const u8,
) -> i32 {
    let (public, message, signature) = match (
        read_bytes(public32, crypto::PUBLIC_LEN),
        read_bytes(msg, msg_len),
        read_bytes(sig64, crypto::SIGNATURE_LEN),
    ) {
        (Some(public), Some(message), Some(signature)) => (public, message, signature),
        _ => return STATUS_BAD_PTR,
    };
    let (public, signature): (&[u8; 32], &[u8; 64]) = match (public.try_into(), signature.try_into()) {
        (Ok(public), Ok(signature)) => (public, signature),
        _ => return STATUS_BAD_PTR,
    };
    if crypto::verify(public, message, signature) {
        STATUS_OK
    } else {
        STATUS_INVALID
    }
}

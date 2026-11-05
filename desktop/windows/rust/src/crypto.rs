//! Ed25519 over raw bytes (WASM-safe: no OS randomness, no I/O).
//!
//! Entropy policy: key generation derives from a caller-provided
//! 32-byte seed. Native hosts SHOULD feed `crypto.randomBytes(32)`
//! (Node) or `OsRng` (see [`generate`], native only). The WASM module
//! never touches randomness itself, so it builds on
//! `wasm32-unknown-unknown` with no randomness backend at all.

use ed25519_dalek::{Signer, SigningKey, Verifier, VerifyingKey};

pub const SEED_LEN: usize = 32;
pub const SECRET_LEN: usize = 32;
pub const PUBLIC_LEN: usize = 32;
pub const SIGNATURE_LEN: usize = 64;

/// Keypair derived from a seed: `(secret_key, public_key)`.
/// Infallible: every 32-byte string is a valid Ed25519 seed.
pub fn keypair_from_seed(seed: &[u8; SEED_LEN]) -> ([u8; SECRET_LEN], [u8; PUBLIC_LEN]) {
    let signing = SigningKey::from_bytes(seed);
    (signing.to_bytes(), signing.verifying_key().to_bytes())
}

/// Generate a fresh random keypair (native only: needs OsRng).
#[cfg(not(target_arch = "wasm32"))]
pub fn generate() -> ([u8; SECRET_LEN], [u8; PUBLIC_LEN]) {
    use rand::rngs::OsRng;
    let signing = SigningKey::generate(&mut OsRng);
    (signing.to_bytes(), signing.verifying_key().to_bytes())
}

/// Sign a message. Infallible for 32-byte secrets.
pub fn sign(secret: &[u8; SECRET_LEN], message: &[u8]) -> [u8; SIGNATURE_LEN] {
    SigningKey::from_bytes(secret).sign(message).to_bytes()
}

/// Verify a signature. `false` on bad signature OR bad public key
/// (never panics on untrusted input).
pub fn verify(public: &[u8; PUBLIC_LEN], message: &[u8], signature: &[u8; SIGNATURE_LEN]) -> bool {
    let key = match VerifyingKey::from_bytes(public) {
        Ok(key) => key,
        Err(_) => return false,
    };
    key.verify(message, &signature.into()).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    const SEED: [u8; 32] = [
        0x9d, 0x61, 0xb1, 0x9f, 0xff, 0xd4, 0x94, 0x53, 0x35, 0xb9, 0x55, 0x2b, 0x0b, 0xa8, 0xec,
        0xb3, 0xf8, 0xe6, 0x2f, 0x8b, 0x6d, 0x86, 0x76, 0xd7, 0xc3, 0xba, 0x0c, 0x53, 0x61, 0xb9,
        0x2c, 0x7b,
    ];

    #[test]
    fn roundtrip_sign_verify() {
        let (secret, public) = keypair_from_seed(&SEED);
        let signature = sign(&secret, b"mission report #7");
        assert!(verify(&public, b"mission report #7", &signature));
    }

    #[test]
    fn rejects_tampered_message_and_signature() {
        let (secret, public) = keypair_from_seed(&SEED);
        let mut signature = sign(&secret, b"pay alice");
        assert!(!verify(&public, b"pay bob", &signature));
        signature[10] ^= 0x01;
        assert!(!verify(&public, b"pay alice", &signature));
    }

    #[test]
    fn rejects_malformed_public_key_without_panic() {
        let (secret, _) = keypair_from_seed(&SEED);
        let signature = sign(&secret, b"data");
        assert!(!verify(&[0xff; 32], b"data", &signature));
        assert!(!verify(&[0x00; 32], b"data", &signature));
    }

    #[test]
    fn derivation_is_deterministic() {
        assert_eq!(keypair_from_seed(&SEED), keypair_from_seed(&SEED));
    }

    #[cfg(not(target_arch = "wasm32"))]
    #[test]
    fn native_generate_produces_verifying_keypairs() {
        let (secret, public) = generate();
        let signature = sign(&secret, b"fresh");
        assert!(verify(&public, b"fresh", &signature));
    }
}

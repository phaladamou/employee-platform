import { createPrivateKey, createPublicKey, randomBytes, sign, verify } from "node:crypto";
import { describe, expect, it } from "vitest";

import { loadRustEd25519 } from "./wrapper";

// ASN.1 prefixes gluing raw Ed25519 keys into PKCS8/SPKI for Node.
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function nodeKeys(secret: Uint8Array, pub: Uint8Array) {
  return {
    privateKey: createPrivateKey({
      key: Buffer.concat([PKCS8_PREFIX, Buffer.from(secret)]),
      format: "der",
      type: "pkcs8",
    }),
    publicKey: createPublicKey({
      key: Buffer.concat([SPKI_PREFIX, Buffer.from(pub)]),
      format: "der",
      type: "spki",
    }),
  };
}

describe("rust WASM ed25519 wrapper", () => {
  it("roundtrips keygen/sign/verify and rejects tampering", async () => {
    const rust = await loadRustEd25519();
    const { secretKey, publicKey } = rust.keypairFromSeed(randomBytes(32));
    const message = Buffer.from("mission report #7");

    const signature = rust.sign(secretKey, message);
    expect(signature).toHaveLength(64);
    expect(rust.verify(publicKey, message, signature)).toBe(true);
    expect(rust.verify(publicKey, Buffer.from("mission report #8"), signature)).toBe(false);

    const tampered = Buffer.from(signature);
    tampered[10] ^= 0x01;
    expect(rust.verify(publicKey, message, tampered)).toBe(false);
    expect(rust.verify(Buffer.alloc(32), message, signature)).toBe(false);
  });

  it("is byte-compatible with Node crypto (both directions)", async () => {
    const rust = await loadRustEd25519();
    const { secretKey, publicKey } = rust.keypairFromSeed(randomBytes(32));
    const { privateKey, publicKey: nodePublic } = nodeKeys(secretKey, publicKey);
    const message = Buffer.from("cross-implementation vector");

    // Node signs -> Rust verifies.
    const nodeSignature = sign(null, message, privateKey);
    expect(rust.verify(publicKey, message, nodeSignature)).toBe(true);

    // Rust signs -> Node verifies (incl. determinism check: same sig).
    const rustSignature = rust.sign(secretKey, message);
    expect(Buffer.from(rustSignature).equals(nodeSignature)).toBe(true);
    expect(verify(null, message, nodePublic, rustSignature)).toBe(true);
  });

  it("derives the same keypair from the same seed", async () => {
    const rust = await loadRustEd25519();
    const seed = randomBytes(32);
    const first = rust.keypairFromSeed(seed);
    const second = rust.keypairFromSeed(seed);
    expect(Buffer.from(first.publicKey).equals(Buffer.from(second.publicKey))).toBe(true);
  });

  it("fails fast on wrong-sized inputs", async () => {
    const rust = await loadRustEd25519();
    expect(() => rust.keypairFromSeed(randomBytes(16))).toThrow("32 bytes");
    const { secretKey, publicKey } = rust.keypairFromSeed(randomBytes(32));
    expect(() => rust.sign(randomBytes(16), Buffer.from("x"))).toThrow("32 bytes");
    expect(() => rust.verify(publicKey, Buffer.from("x"), randomBytes(16))).toThrow("64 bytes");
    expect(secretKey).toHaveLength(32);
  });
});

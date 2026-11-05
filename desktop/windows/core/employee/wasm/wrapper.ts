/**
 * TypeScript wrapper for the Rust WASM crypto module
 * (`core/employee/wasm/dist/employee_native.wasm`, built by
 * `rust/build.sh`). Used by `missions/mission-proof.ts` for Ed25519
 * signatures, with a Node `crypto` fallback when the module cannot
 * load (see the backend selection there).
 *
 * Same Ed25519 semantics as Node `crypto` (proven by
 * cross-verification in `wrapper.test.ts`).
 *
 * Entropy comes from the host: pass 32 bytes from
 * `crypto.randomBytes(32)` as the seed. The WASM module never
 * touches randomness (no getrandom backend on wasm32-unknown-unknown).
 */

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SEED_LEN = 32;
export const SECRET_LEN = 32;
export const PUBLIC_LEN = 32;
export const SIGNATURE_LEN = 64;

interface WasmCryptoExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  emp_alloc(len: number): number;
  emp_free(ptr: number, len: number): void;
  ed_keypair_from_seed(seedPtr: number, outPtr: number): number;
  ed_sign(secretPtr: number, msgPtr: number, msgLen: number, outPtr: number): number;
  ed_verify(pubPtr: number, msgPtr: number, msgLen: number, sigPtr: number): number;
}

export interface RustKeypair {
  readonly secretKey: Uint8Array;
  readonly publicKey: Uint8Array;
}

export interface RustEd25519 {
  keypairFromSeed(seed: Uint8Array): RustKeypair;
  sign(secretKey: Uint8Array, message: Uint8Array): Uint8Array;
  verify(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean;
}

function checkLength(name: string, value: Uint8Array, expected: number): void {
  if (value.length !== expected) {
    throw new Error(`${name} must be ${expected} bytes, got ${value.length}`);
  }
}

export function defaultWasmPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "dist", "employee_native.wasm");
}

/** Instantiate the module (imports-free: no env, no WASI). */
export async function loadRustEd25519(wasmPath: string = defaultWasmPath()): Promise<RustEd25519> {
  const bytes = await readFile(wasmPath);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return createApi(instance.exports as WasmCryptoExports);
}

/** Synchronous twin (mission proofs are sync): same module, same API. */
export function loadRustEd25519Sync(wasmPath: string = defaultWasmPath()): RustEd25519 {
  const bytes = readFileSync(wasmPath);
  const module = new WebAssembly.Module(bytes);
  const instance = new WebAssembly.Instance(module, {});
  return createApi(instance.exports as WasmCryptoExports);
}

function createApi(wasm: WasmCryptoExports): RustEd25519 {
  if (
    !(wasm.memory instanceof WebAssembly.Memory) ||
    typeof wasm.emp_alloc !== "function" ||
    typeof wasm.emp_free !== "function" ||
    typeof wasm.ed_keypair_from_seed !== "function" ||
    typeof wasm.ed_sign !== "function" ||
    typeof wasm.ed_verify !== "function"
  ) {
    throw new Error("WASM module does not export the ed25519 ABI");
  }

  function writeInput(data: Uint8Array): number {
    const ptr = wasm.emp_alloc(data.length);
    new Uint8Array(wasm.memory.buffer, ptr, data.length).set(data);
    return ptr;
  }

  function readOutput(ptr: number, len: number): Uint8Array {
    // Copy out: the buffer may grow (detach) on later allocations.
    return new Uint8Array(wasm.memory.buffer.slice(ptr, ptr + len));
  }

  return {
    keypairFromSeed(seed: Uint8Array): RustKeypair {
      checkLength("seed", seed, SEED_LEN);
      const seedPtr = writeInput(seed);
      const outPtr = wasm.emp_alloc(SECRET_LEN + PUBLIC_LEN);
      try {
        const status = wasm.ed_keypair_from_seed(seedPtr, outPtr);
        if (status !== 0) {
          throw new Error(`ed_keypair_from_seed failed (status ${status})`);
        }
        const blob = readOutput(outPtr, SECRET_LEN + PUBLIC_LEN);
        return {
          secretKey: blob.slice(0, SECRET_LEN),
          publicKey: blob.slice(SECRET_LEN),
        };
      } finally {
        wasm.emp_free(seedPtr, seed.length);
        wasm.emp_free(outPtr, SECRET_LEN + PUBLIC_LEN);
      }
    },

    sign(secretKey: Uint8Array, message: Uint8Array): Uint8Array {
      checkLength("secretKey", secretKey, SECRET_LEN);
      const secretPtr = writeInput(secretKey);
      const msgPtr = writeInput(message);
      const outPtr = wasm.emp_alloc(SIGNATURE_LEN);
      try {
        const status = wasm.ed_sign(secretPtr, msgPtr, message.length, outPtr);
        if (status !== 0) {
          throw new Error(`ed_sign failed (status ${status})`);
        }
        return readOutput(outPtr, SIGNATURE_LEN);
      } finally {
        wasm.emp_free(secretPtr, secretKey.length);
        wasm.emp_free(msgPtr, message.length);
        wasm.emp_free(outPtr, SIGNATURE_LEN);
      }
    },

    verify(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
      checkLength("publicKey", publicKey, PUBLIC_LEN);
      checkLength("signature", signature, SIGNATURE_LEN);
      const pubPtr = writeInput(publicKey);
      const msgPtr = writeInput(message);
      const sigPtr = writeInput(signature);
      try {
        const status = wasm.ed_verify(pubPtr, msgPtr, message.length, sigPtr);
        if (status !== 0 && status !== 1) {
          throw new Error(`ed_verify failed (status ${status})`);
        }
        return status === 0;
      } finally {
        wasm.emp_free(pubPtr, publicKey.length);
        wasm.emp_free(msgPtr, message.length);
        wasm.emp_free(sigPtr, signature.length);
      }
    },
  };
}

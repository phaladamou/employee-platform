import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  createHash,
  sign,
  verify,
} from "node:crypto";

import type { EmployeeMission } from "./employee-mission";
import {
  loadRustEd25519Sync,
  type RustEd25519,
} from "../wasm/wrapper";

export const MISSION_PROOF_VERSION = 1;

/**
 * Certificat de mission (CV verifiable) : prouve qu'une mission s'est
 * terminee, SANS son contenu confidentiel (ni prompt, ni rapport).
 * Le contenu reste prouvable par divulgation selective : si l'employe
 * revele plus tard le rapport, n'importe qui recalcule son SHA-256 et
 * le compare a `reportHash` (voir `verifyReportDisclosure`).
 */
export interface MissionProof {
  readonly version: number;
  readonly missionId: string;
  readonly employeeId: string;
  readonly employerId: string;
  /** SHA-256 hex du contenu du rapport (jamais le rapport). */
  readonly reportHash: string;
  readonly completedAt: string;
  /** Cle publique operateur emettrice (PEM SPKI). */
  readonly issuer: string;
  /** Signature Ed25519 du certificat canonique (base64url). */
  readonly signature: string;
}

export interface OperatorKeyPair {
  readonly publicKeyPem: string;
  readonly privateKeyPem: string;
}

/** SHA-256 hex d'un contenu (rapport, prompt...). */
export function hashReportContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export type CryptoBackendName = "wasm" | "node";

/**
 * Selection du backend Ed25519. `wasmPath` force un module precis
 * (tests), `false` force Node (tests, environnements sans WASM).
 * Par defaut : WASM embarque, repli Node sur tout echec de chargement
 * (fichier absent, module corrompu). Seuls sign/verify passent par le
 * WASM ; generation de cles et SHA-256 restent sur Node.
 */
export interface ProofCryptoOptions {
  readonly wasmPath?: string | false;
}

let cachedWasm: RustEd25519 | null = null;
let cachedWasmPath: string | undefined = undefined;
let lastBackend: CryptoBackendName | null = null;

/** Backend utilise par la derniere operation (tests uniquement). */
export function _lastCryptoBackendForTests(): CryptoBackendName | null {
  return lastBackend;
}

function loadBackend(wasmPath?: string | false): RustEd25519 | null {
  if (wasmPath === false) {
    lastBackend = "node";
    return null;
  }
  if (cachedWasm && cachedWasmPath === wasmPath) {
    lastBackend = "wasm";
    return cachedWasm;
  }
  try {
    const backend =
      wasmPath === undefined
        ? loadRustEd25519Sync()
        : loadRustEd25519Sync(wasmPath);
    cachedWasm = backend;
    cachedWasmPath = wasmPath;
    lastBackend = "wasm";
    return backend;
  } catch {
    lastBackend = "node";
    return null;
  }
}

// ASN.1 fixes collant les cles Ed25519 brutes dans PKCS8/SPKI.
const PKCS8_ED25519_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex"
);
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function pemBody(pem: string, label: string): Buffer {
  if (!pem.includes(`-----BEGIN ${label}-----`)) {
    throw new Error(`not a ${label} PEM document`);
  }
  return Buffer.from(
    pem
      .replace(/-----(BEGIN|END) [A-Z ]+-----/g, "")
      .replace(/\s+/g, ""),
    "base64"
  );
}

/** Graine 32 octets depuis une cle privee PKCS8 Ed25519 (PEM). */
function ed25519SeedFromPkcs8(privateKeyPem: string): Uint8Array {
  const der = pemBody(privateKeyPem, "PRIVATE KEY");
  if (
    der.length !== PKCS8_ED25519_PREFIX.length + 32 ||
    !der.subarray(0, PKCS8_ED25519_PREFIX.length).equals(PKCS8_ED25519_PREFIX)
  ) {
    throw new Error("private key is not an Ed25519 PKCS8 key");
  }
  return new Uint8Array(der.subarray(PKCS8_ED25519_PREFIX.length));
}

/** Cle publique 32 octets depuis un SPKI Ed25519 (PEM). */
function ed25519PublicFromSpki(publicKeyPem: string): Uint8Array {
  const der = pemBody(publicKeyPem, "PUBLIC KEY");
  if (
    der.length !== SPKI_ED25519_PREFIX.length + 32 ||
    !der.subarray(0, SPKI_ED25519_PREFIX.length).equals(SPKI_ED25519_PREFIX)
  ) {
    throw new Error("public key is not an Ed25519 SPKI key");
  }
  return new Uint8Array(der.subarray(SPKI_ED25519_PREFIX.length));
}

/** SPKI PEM (format Node : lignes 64 col + newline final). */
function spkiPemFromRawPublic(publicKey: Uint8Array): string {
  const der = Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(publicKey)]);
  const body = der.toString("base64");
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----\n`;
}

/**
 * Genere une paire operateur Ed25519. La cle privee signe les preuves
 * (serveur uniquement) ; la cle publique se diffuse aux verifieurs.
 */
export function generateOperatorKeyPair(): OperatorKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");

  return {
    publicKeyPem: publicKey
      .export({ type: "spki", format: "pem" })
      .toString(),
    privateKeyPem: privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString(),
  };
}

/** JSON canonique : cles triees, sans espaces (bytes signes stables). */
function canonicalize(value: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = value[key];
  }
  return JSON.stringify(sorted);
}

function certificateBytes(certificate: {
  version: number;
  missionId: string;
  employeeId: string;
  employerId: string;
  reportHash: string;
  completedAt: string;
  issuer: string;
}): Buffer {
  return Buffer.from(
    canonicalize(certificate as unknown as Record<string, unknown>),
    "utf8"
  );
}

/**
 * Emet un certificat pour une mission TERMINEE (completed + rapport).
 * Tout autre statut leve : on ne certifie que le travail acheve —
 * needs_review et failed ne produisent JAMAIS de preuve valide.
 * Invariant : une mission completed AVEC criteres les a forcement
 * verifies (le runtime echoue sinon avant completion) ; sans
 * criteres, completed vaut confiance documentee, pas preuve du but.
 * `employerId` doit etre renseigne (mission scopee) : une preuve
 * anonyme ("quelque part") n'a pas de valeur de CV.
 */
export function generateMissionProof(
  mission: EmployeeMission,
  privateKeyPem: string,
  options: ProofCryptoOptions = {}
): MissionProof {
  if (mission.status !== "completed" || !mission.report) {
    throw new Error(
      `Mission ${mission.id} is not completed, no proof can be issued`
    );
  }
  if (!mission.employeeId) {
    throw new Error(`Mission ${mission.id} is not assigned`);
  }
  if (!mission.employerId) {
    throw new Error(
      `Mission ${mission.id} has no employer, proof would be meaningless`
    );
  }
  if (!privateKeyPem.trim()) {
    throw new Error("Operator private key cannot be empty");
  }

  const backend = loadBackend(options.wasmPath);

  const issuer = backend
    ? spkiPemFromRawPublic(
        backend.keypairFromSeed(ed25519SeedFromPkcs8(privateKeyPem)).publicKey
      )
    : createPublicKey(createPrivateKey(privateKeyPem))
        .export({ type: "spki", format: "pem" })
        .toString();

  const certificate = {
    version: MISSION_PROOF_VERSION,
    missionId: mission.id,
    employeeId: mission.employeeId,
    employerId: mission.employerId,
    reportHash: hashReportContent(mission.report.content),
    completedAt: mission.report.completedAt,
    issuer,
  };

  const signature = backend
    ? Buffer.from(
        backend.sign(
          ed25519SeedFromPkcs8(privateKeyPem),
          certificateBytes(certificate)
        )
      )
    : sign(null, certificateBytes(certificate), createPrivateKey(privateKeyPem));

  return {
    ...certificate,
    signature: signature.toString("base64url"),
  };
}

function isProofShape(value: unknown): value is MissionProof {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const proof = value as Record<string, unknown>;

  return (
    proof.version === MISSION_PROOF_VERSION &&
    typeof proof.missionId === "string" &&
    proof.missionId.length > 0 &&
    typeof proof.employeeId === "string" &&
    proof.employeeId.length > 0 &&
    typeof proof.employerId === "string" &&
    proof.employerId.length > 0 &&
    typeof proof.reportHash === "string" &&
    /^[0-9a-f]{64}$/.test(proof.reportHash) &&
    typeof proof.completedAt === "string" &&
    !Number.isNaN(Date.parse(proof.completedAt)) &&
    typeof proof.issuer === "string" &&
    proof.issuer.length > 0 &&
    typeof proof.signature === "string" &&
    proof.signature.length > 0
  );
}

/**
 * Verifie un certificat : structure, version, puis signature Ed25519.
 * `expectedIssuer` (PEM publique de confiance) epingle l'emetteur :
 * sans lui, on prouve l'authenticite cryptographique, pas l'identite
 * de l'emetteur (comparer `proof.issuer` a la cle publiee de
 * l'operateur). Ne leve jamais : tout doute vaut `false`.
 */
export function verifyMissionProof(
  proof: unknown,
  expectedIssuer?: string,
  options: ProofCryptoOptions = {}
): boolean {
  try {
    if (!isProofShape(proof)) {
      return false;
    }
    if (expectedIssuer !== undefined && proof.issuer !== expectedIssuer) {
      return false;
    }

    const { signature, ...certificate } = proof;
    const bytes = certificateBytes(certificate);
    const raw = Buffer.from(signature, "base64url");
    const backend = loadBackend(options.wasmPath);

    if (backend) {
      if (raw.length !== 64) {
        return false;
      }
      return backend.verify(
        ed25519PublicFromSpki(proof.issuer),
        bytes,
        new Uint8Array(raw)
      );
    }

    const publicKey = createPublicKey(proof.issuer);
    return verify(null, bytes, publicKey, raw);
  } catch {
    return false;
  }
}

/**
 * Divulgation selective : l'employe revele un rapport presume ; vrai
 * ssi son hash correspond au certificat. Permet de prouver le contenu
 * APRES coup, sans l'avoir expose dans la preuve.
 */
export function verifyReportDisclosure(
  proof: MissionProof,
  reportContent: string
): boolean {
  return hashReportContent(reportContent) === proof.reportHash;
}

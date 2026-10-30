import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  createHash,
  sign,
  verify,
} from "node:crypto";

import type { EmployeeMission } from "./employee-mission";

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
 * Tout autre statut leve : on ne certifie que le travail acheve.
 * `employerId` doit etre renseigne (mission scopee) : une preuve
 * anonyme ("quelque part") n'a pas de valeur de CV.
 */
export function generateMissionProof(
  mission: EmployeeMission,
  privateKeyPem: string
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

  const privateKey = createPrivateKey(privateKeyPem);
  const issuer = createPublicKey(privateKey)
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

  const signature = sign(null, certificateBytes(certificate), privateKey);

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
  expectedIssuer?: string
): boolean {
  try {
    if (!isProofShape(proof)) {
      return false;
    }
    if (expectedIssuer !== undefined && proof.issuer !== expectedIssuer) {
      return false;
    }

    const { signature, ...certificate } = proof;
    const publicKey = createPublicKey(proof.issuer);
    const raw = Buffer.from(signature, "base64url");

    return verify(null, certificateBytes(certificate), publicKey, raw);
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

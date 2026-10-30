import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  assignMission,
  completeEmployeeMission,
  createEmployeeMission,
  failEmployeeMission,
  flagMissionForReview,
  startEmployeeMission,
} from "./employee-mission";
import {
  generateMissionProof,
  generateOperatorKeyPair,
  hashReportContent,
  verifyMissionProof,
  verifyReportDisclosure,
} from "./mission-proof";

function completedMission() {
  return completeEmployeeMission(
    startEmployeeMission(
      assignMission(
        createEmployeeMission({ prompt: "Audit", employerId: "acme" }),
        "emp_1"
      )
    ),
    { summary: "Done", content: "Full report content." }
  );
}

describe("hashReportContent", () => {
  it("is plain SHA-256 hex", () => {
    expect(hashReportContent("hello")).toBe(
      createHash("sha256").update("hello", "utf8").digest("hex")
    );
  });
});

describe("generateMissionProof", () => {
  it("issues a certificate without confidential content", () => {
    const keys = generateOperatorKeyPair();

    const proof = generateMissionProof(
      completedMission(),
      keys.privateKeyPem
    );

    expect(proof.version).toBe(1);
    expect(proof.missionId).toBeTruthy();
    expect(proof.employeeId).toBe("emp_1");
    expect(proof.employerId).toBe("acme");
    expect(proof.reportHash).toBe(hashReportContent("Full report content."));
    expect(proof.issuer).toBe(keys.publicKeyPem);

    const serialized = JSON.stringify(proof);
    expect(serialized).not.toContain("Full report content.");
    expect(serialized).not.toContain("Audit");
    expect(serialized).not.toContain("Done");
  });

  it("refuses unfinished, unassigned or unscoped missions", () => {
    const keys = generateOperatorKeyPair();

    expect(() =>
      generateMissionProof(createEmployeeMission({ prompt: "x" }), keys.privateKeyPem)
    ).toThrow("is not completed");

    const failed = failEmployeeMission(
      startEmployeeMission(
        assignMission(
          createEmployeeMission({ prompt: "x", employerId: "acme" }),
          "emp_1"
        )
      ),
      "boom"
    );
    expect(() => generateMissionProof(failed, keys.privateKeyPem)).toThrow(
      "is not completed"
    );

    const unscoped = completeEmployeeMission(
      startEmployeeMission(
        assignMission(createEmployeeMission({ prompt: "x" }), "emp_1")
      ),
      { summary: "s", content: "c" }
    );
    expect(() => generateMissionProof(unscoped, keys.privateKeyPem)).toThrow(
      "has no employer"
    );

    // Pas de certificat pour le travail non revu : seul completed prouve.
    const flagged = flagMissionForReview(
      startEmployeeMission(
        assignMission(
          createEmployeeMission({ prompt: "x", employerId: "acme" }),
          "emp_1"
        )
      ),
      { summary: "s", content: "c" }
    );
    expect(() => generateMissionProof(flagged, keys.privateKeyPem)).toThrow(
      "is not completed"
    );
  });
});

describe("verifyMissionProof", () => {
  it("accepts genuine proofs, pinned or not", () => {
    const keys = generateOperatorKeyPair();
    const proof = generateMissionProof(
      completedMission(),
      keys.privateKeyPem
    );

    expect(verifyMissionProof(proof)).toBe(true);
    expect(verifyMissionProof(proof, keys.publicKeyPem)).toBe(true);
  });

  it("rejects tampered fields", () => {
    const keys = generateOperatorKeyPair();
    const proof = generateMissionProof(
      completedMission(),
      keys.privateKeyPem
    );

    expect(
      verifyMissionProof({ ...proof, employeeId: "emp_attacker" })
    ).toBe(false);
    expect(
      verifyMissionProof({ ...proof, employerId: "globex" })
    ).toBe(false);
    expect(
      verifyMissionProof({ ...proof, reportHash: "0".repeat(64) })
    ).toBe(false);
    expect(
      verifyMissionProof({ ...proof, completedAt: "2020-01-01T00:00:00.000Z" })
    ).toBe(false);
    expect(
      verifyMissionProof({
        ...proof,
        signature: Buffer.from("forged").toString("base64url"),
      })
    ).toBe(false);
  });

  it("rejects foreign issuers and pinned mismatches", () => {
    const keys = generateOperatorKeyPair();
    const other = generateOperatorKeyPair();
    const proof = generateMissionProof(
      completedMission(),
      keys.privateKeyPem
    );

    expect(verifyMissionProof(proof, other.publicKeyPem)).toBe(false);
    expect(
      verifyMissionProof({ ...proof, issuer: other.publicKeyPem })
    ).toBe(false);
  });

  it("rejects missionId, version and injected-field tampering", () => {
    const keys = generateOperatorKeyPair();
    const proof = generateMissionProof(
      completedMission(),
      keys.privateKeyPem
    );

    expect(verifyMissionProof({ ...proof, missionId: "mis_other" })).toBe(
      false
    );
    expect(verifyMissionProof({ ...proof, version: 2 })).toBe(false);
    expect(
      verifyMissionProof({ ...proof, role: "admin" } as unknown as typeof proof)
    ).toBe(false);
  });

  it("models rotation: old proofs fail against the new pinned key", () => {
    const oldKeys = generateOperatorKeyPair();
    const oldProof = generateMissionProof(
      completedMission(),
      oldKeys.privateKeyPem
    );

    // Rotation : nouvel emetteur publie, les verifieurs re-pinnent.
    const newKeys = generateOperatorKeyPair();
    const newProof = generateMissionProof(
      completedMission(),
      newKeys.privateKeyPem
    );

    expect(verifyMissionProof(oldProof, newKeys.publicKeyPem)).toBe(false);
    expect(verifyMissionProof(newProof, newKeys.publicKeyPem)).toBe(true);
    // ... mais les anciennes preuves restent valides en non-epingle :
    // sans CRL, la rotation est totale (tout l'historique tombe) ou rien.
    expect(verifyMissionProof(oldProof)).toBe(true);
  });

  it("documents unpinned trust: well-formed foreign proofs pass", () => {
    // Semantique epinglee : sans pinning, on prouve l'authenticite
    // cryptographique (quelqu'un detient CETTE cle privee), pas que
    // l'emetteur est l'operateur legitime. Les verifieurs DOIVENT
    // comparer proof.issuer a la cle publiee (ou pinner).
    const attacker = generateOperatorKeyPair();
    const forged = generateMissionProof(
      completedMission(),
      attacker.privateKeyPem
    );

    expect(verifyMissionProof(forged)).toBe(true);
    expect(forged.issuer).toBe(attacker.publicKeyPem);
  });

  it("never throws on garbage", () => {
    expect(verifyMissionProof(null)).toBe(false);
    expect(verifyMissionProof("nope")).toBe(false);
    expect(verifyMissionProof({})).toBe(false);
    expect(verifyMissionProof({ version: 1 })).toBe(false);
    expect(
      verifyMissionProof({
        version: 1,
        missionId: "m",
        employeeId: "e",
        employerId: "a",
        reportHash: "xyz",
        completedAt: "not-a-date",
        issuer: "not-a-key",
        signature: "!!!",
      })
    ).toBe(false);
  });
});

describe("verifyReportDisclosure", () => {
  it("confirms a later revealed report", () => {
    const keys = generateOperatorKeyPair();
    const proof = generateMissionProof(
      completedMission(),
      keys.privateKeyPem
    );

    expect(verifyReportDisclosure(proof, "Full report content.")).toBe(true);
    expect(verifyReportDisclosure(proof, "Doctored content.")).toBe(false);
  });
});

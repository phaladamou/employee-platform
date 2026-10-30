import { describe, expect, it } from "vitest";

import {
  detectRefusalAdmission,
  detectUnsupportedClaims,
} from "./mission-claims";

describe("detectUnsupportedClaims", () => {
  it("flags file-creation claims with no successful write", () => {
    for (const report of [
      "Created HACKED.txt, trust me.",
      "I created HACKED.txt as requested.",
      "I've written notes.md with the findings.",
      "File created.",
      "The files were updated this morning.",
      "Summary done.\nCreated summary.txt from the sales data.",
    ]) {
      const claims = detectUnsupportedClaims(report, []);
      expect(claims.map((claim) => claim.category)).toEqual(["file"]);
    }
  });

  it("flags file-creation claims in French", () => {
    for (const report of [
      "J'ai créé HACKED.txt comme demandé.",
      "Fichier créé.",
      "Le fichier est enregistré.",
    ]) {
      const claims = detectUnsupportedClaims(report, []);
      expect(claims.map((claim) => claim.category)).toEqual(["file"]);
    }
  });

  it("flags message-sent claims, never supportable without a send tool", () => {
    for (const report of [
      "Email sent to boss@acme.test with the quarterly report.",
      "I sent the report to boss@acme.test yesterday.",
      "J'ai envoyé le rapport à boss@acme.test.",
      "Email envoyé au patron.",
      "I emailed the team about the delay.",
    ]) {
      // Meme avec des lectures reussies : aucun outil d'envoi n'existe.
      const claims = detectUnsupportedClaims(report, ["read_file"]);
      expect(claims.map((claim) => claim.category)).toEqual(["message"]);
    }
  });

  it("flags command-execution claims with no successful shell", () => {
    for (const report of [
      "I ran the command and it worked.",
      "Command executed successfully.",
      "J'ai exécuté la commande demandée.",
      "La commande exécutée avec succès.",
    ]) {
      const claims = detectUnsupportedClaims(report, []);
      expect(claims.map((claim) => claim.category)).toEqual(["command"]);
    }
  });

  it("accepts claims supported by a matching successful tool", () => {
    expect(
      detectUnsupportedClaims("Created hello.txt as requested.", ["write_file"])
    ).toEqual([]);
    expect(
      detectUnsupportedClaims("I ran the command.", ["run_shell"])
    ).toEqual([]);
    expect(
      detectUnsupportedClaims("J'ai créé notes.md.", ["write_file"])
    ).toEqual([]);
  });

  it("ignores knowledge reports without effect vocabulary", () => {
    for (const report of [
      "Hello.",
      "Alpha done.",
      "The eagle has landed.",
      "Churn is seasonal.",
      "Answered from knowledge.",
      "All done.",
      "Read it.",
      "Shell unavailable, mission done without it.",
    ]) {
      expect(detectUnsupportedClaims(report, [])).toEqual([]);
    }
  });

  it("ignores success verbs without a concrete artifact", () => {
    // "created a summary" : pas de fichier nomme, pas de drapeau.
    expect(
      detectUnsupportedClaims("I created a summary of the findings.", [])
    ).toEqual([]);
    expect(
      detectUnsupportedClaims("Created a plan for Q3, see above.", [])
    ).toEqual([]);
    // "sent" sans canal : fournir une analyse n'est pas envoyer un message.
    expect(
      detectUnsupportedClaims("I sent my analysis, let me know.", [])
    ).toEqual([]);
    // "ran" sans commande : une analyse n'est pas un shell.
    expect(
      detectUnsupportedClaims("I ran the analysis on sales.txt.", [])
    ).toEqual([]);
  });

  it("ignores honest failure reports and third-party actions", () => {
    expect(
      detectUnsupportedClaims(
        "I could not write the file: path escapes the workspace. No file was created.",
        []
      )
    ).toEqual([]);
    // L'expediteur est un tiers, pas l'agent.
    expect(
      detectUnsupportedClaims("The user sent an email asking for help.", [])
    ).toEqual([]);
    // Brouillon cite, pas envoi.
    expect(
      detectUnsupportedClaims("Here is the drafted message: buy milk.", [])
    ).toEqual([]);
  });

  it("ignores file effects attributed to a third party", () => {
    for (const report of [
      "Results. File created by the user last week contains errors.",
      "All good. File updated by you yesterday.",
      "Résultats. Fichier créé par l'utilisateur la semaine dernière.",
      "Vérifié. Fichier enregistré par vous hier.",
    ]) {
      expect(detectUnsupportedClaims(report, [])).toEqual([]);
    }
    // Agent ambigu (script, systeme) : revue humaine, pas confiance.
    expect(
      detectUnsupportedClaims("File created by the script.", []).map(
        (claim) => claim.category
      )
    ).toEqual(["file"]);
  });

  it("reports one claim per category with a readable excerpt", () => {
    // Ordre des motifs (1re personne d'abord), pas ordre du texte.
    const claims = detectUnsupportedClaims(
      "Created a.txt. Then I created b.txt too.",
      []
    );
    expect(claims).toHaveLength(1);
    expect(claims[0]?.category).toBe("file");
    expect(claims[0]?.excerpt).toContain("b.txt");
    expect(claims[0]?.excerpt.length).toBeLessThanOrEqual(120);
  });
});

describe("detectRefusalAdmission", () => {
  it("flags explicit non-completion admissions", () => {
    for (const report of [
      "Mission not executed. No file was created.",
      "I could not write the file: path escapes the workspace.",
      "I couldn't complete the analysis in time.",
      "Unable to run the command with these tools.",
      "Requested action cannot be run: no shell available.",
      "I cannot complete the mission as specified.",
      "No report was sent to anyone.",
      "The task was not completed before the deadline.",
      "I failed to produce the deliverable.",
      "I did not manage to finish on time.",
      "It is impossible to complete without source data.",
    ]) {
      expect(detectRefusalAdmission(report)).not.toBeNull();
    }
  });

  it("flags refusals in French", () => {
    for (const report of [
      "Mission non exécutée, aucun fichier modifié.",
      "Je n'ai pas pu terminer l'analyse.",
      "Le rapport n'a pas été envoyé.",
      "Impossible de terminer sans les données.",
      "Aucun fichier n'a été créé.",
      "Statut : non exécuté.",
    ]) {
      expect(detectRefusalAdmission(report)).not.toBeNull();
    }
  });

  it("ignores completion vocabulary outside refusal scope", () => {
    for (const report of [
      "I could not find any issues in the data.",
      "It is impossible to overstate Q3 growth.",
      "Analysis complete. Note: I cannot execute commands, only analyze.",
      "The task was challenging but done.",
      "No errors were found.",
      "Mission accomplished ahead of schedule.",
      "J'ai terminé l'analyse demandée.",
      "Je n'ai pas pu m'empêcher de remarquer une anomalie.",
    ]) {
      expect(detectRefusalAdmission(report)).toBeNull();
    }
  });

  it("returns the matched excerpt for the review reason", () => {
    const refusal = detectRefusalAdmission(
      "Summary done. Mission not executed: shell unavailable."
    );
    expect(refusal?.excerpt).toContain("Mission not executed");
    expect(refusal?.excerpt.length).toBeLessThanOrEqual(120);
  });
});

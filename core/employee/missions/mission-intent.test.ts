import { describe, expect, it } from "vitest";

import {
  assertAcceptanceForIntent,
  detectMissionIntent,
} from "./mission-intent";

describe("detectMissionIntent", () => {
  it("detects file creation in English and French", () => {
    for (const prompt of [
      "Create hello.txt",
      "Please create a config file",
      "Write a script that greets",
      "Wrote the report file yesterday, review it",
      "Generate the monthly file",
      "Crée un fichier hello.py",
      "Créer le fichier de config",
      "Écris un script de sauvegarde",
      "Génère le fichier de sortie",
      "Recreate app.py from scratch",
      "Réécris le fichier de conf",
    ]) {
      expect(detectMissionIntent(prompt).wantsFileCreation, prompt).toBe(true);
    }
  });

  it("detects bugfixes in English and French", () => {
    for (const prompt of [
      "Fix the login bug",
      "There is a bug in checkout",
      "Debug the payment flow",
      "Corrige le bug de connexion",
      "Corriger l'erreur de calcul",
      "Répare le plantage au démarrage",
      "Apply the hotfix patch",
    ]) {
      expect(detectMissionIntent(prompt).wantsBugfix, prompt).toBe(true);
    }
  });

  it("ignores neutral prompts and near-misses", () => {
    for (const prompt of [
      "Say hello",
      "Audit churn",
      "Do it",
      "Write hello",
      "Run echo via shell",
      "Land the eagle",
      "Résume le fichier de notes",
      "Lis le rapport et commente",
      "Check the prefix of each name",
      "List the fixtures directory",
      "General review of the codebase",
      "Write a post-scriptum",
    ]) {
      expect(detectMissionIntent(prompt)).toEqual({
        wantsFileCreation: false,
        wantsBugfix: false,
      });
    }
  });
});

describe("assertAcceptanceForIntent", () => {
  it("requires file acceptance for creation intents", () => {
    expect(() =>
      assertAcceptanceForIntent("Create hello.txt", { files: [] })
    ).toThrow("--expect-file");
    expect(() =>
      assertAcceptanceForIntent("Crée un fichier a.py", { files: [] })
    ).toThrow("--expect-file");
    expect(() =>
      assertAcceptanceForIntent("Create hello.txt", {
        files: [{ path: "hello.txt", contains: null }],
      })
    ).not.toThrow();
  });

  it("requires test acceptance for bugfix intents", () => {
    expect(() =>
      assertAcceptanceForIntent("Fix the login bug", { files: [] })
    ).toThrow("--expect-test");
    expect(() =>
      assertAcceptanceForIntent("Corrige le bug", { files: [] })
    ).toThrow("--expect-test");
    expect(() =>
      assertAcceptanceForIntent("Fix the login bug", {
        files: [],
        tests: [{ command: "pytest" }],
      })
    ).not.toThrow();
  });

  it("lets neutral prompts through without criteria", () => {
    expect(() =>
      assertAcceptanceForIntent("Audit churn", { files: [] })
    ).not.toThrow();
  });
});

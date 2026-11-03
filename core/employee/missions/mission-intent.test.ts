import { describe, expect, it } from "vitest";

import {
  assertAcceptanceForIntent,
  detectMissionIntent,
  isGithubMission,
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

describe("isGithubMission", () => {
  it("accepts explicit GitHub workflows (verified on GitHub, not on disk)", () => {
    for (const prompt of [
      "Fork octocat/Hello-World and fix the typo in the README",
      "Clone the repo and open a pull request",
      "Create an issue on your fork, then open a PR",
      "GitHub demo mission on octocat/Hello-World. Work ONLY on YOUR fork.",
      "Corrige le typo du README et ouvre une PR sur GitHub",
      "Fork the repo, create an issue, push a branch and open a pull request",
    ]) {
      expect(isGithubMission(prompt), prompt).toBe(true);
    }
  });

  it("rejects local work and near-misses", () => {
    for (const prompt of [
      "Fix the bug in utils.ts",
      "Create a config file for the project",
      "Report the quarterly results",
      "Check the tissue box inventory",
      "Read the repository docs",
      "Corrige le bug de connexion",
    ]) {
      expect(isGithubMission(prompt), prompt).toBe(false);
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

  it("lets GitHub missions through without local criteria", () => {
    // Saveur creation de fichier (miroir du prompt du harnais E2E :
    // "create" dans github_create_issue + "README file").
    expect(() =>
      assertAcceptanceForIntent(
        "Fork octocat/Hello-World with github_fork. " +
          "Create an issue with github_create_issue. " +
          "Read the README file from the clone, then open a PR.",
        { files: [] }
      )
    ).not.toThrow();
    // Saveur bugfix.
    expect(() =>
      assertAcceptanceForIntent(
        "Fork the repo and fix the typo in the README, then open a PR.",
        { files: [] }
      )
    ).not.toThrow();
  });

  it("keeps detection truthful: only the requirement is lifted for GitHub", () => {
    expect(
      detectMissionIntent(
        "Fork octocat/Hello-World with github_fork. " +
          "Create an issue with github_create_issue. " +
          "Read the README file from the clone, then open a PR."
      ).wantsFileCreation
    ).toBe(true);
  });
});

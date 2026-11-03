// lib/engineering/files.test.ts
// Contrat des helpers IDE (arbre + langage + securite chemins).
// Execution : node --test lib/engineering/files.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildFileTree,
  isSafeWorkspacePath,
  languageForPath,
} from "./files.ts";

describe("isSafeWorkspacePath", () => {
  it("accepte un chemin relatif simple", () => {
    assert.equal(isSafeWorkspacePath("src/app.py"), true);
  });

  it("refuse les echappatoires", () => {
    assert.equal(isSafeWorkspacePath("../secret.txt"), false);
    assert.equal(isSafeWorkspacePath("/etc/passwd"), false);
    assert.equal(isSafeWorkspacePath("a//b"), false);
    assert.equal(isSafeWorkspacePath(""), false);
  });
});

describe("languageForPath", () => {
  it("mappe les extensions connues", () => {
    assert.equal(languageForPath("app.py"), "python");
    assert.equal(languageForPath("src/index.ts"), "typescript");
    assert.equal(languageForPath("data.json"), "json");
    assert.equal(languageForPath("run.sh"), "bash");
  });

  it("retombe sur text sinon", () => {
    assert.equal(languageForPath("README"), "text");
    assert.equal(languageForPath("file.inconnu"), "text");
  });
});

describe("buildFileTree", () => {
  it("construit dossiers puis fichiers tries", () => {
    const tree = buildFileTree(["b.py", "src/app.py", "src/lib/util.py"]);
    assert.equal(tree.length, 2);
    assert.equal(tree[0].type, "dir");
    assert.equal(tree[0].name, "src");
    assert.equal(tree[1].name, "b.py");
    assert.equal(tree[0].children?.length, 2);
  });

  it("ignore les chemins dangereux", () => {
    const tree = buildFileTree(["ok.py", "../evil.txt"]);
    assert.equal(tree.length, 1);
    assert.equal(tree[0].name, "ok.py");
  });
});

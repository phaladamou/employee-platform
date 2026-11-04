// lib/engineering/files.test.ts
// Contrat des helpers IDE (arbre + langage + securite chemins).
// Execution : node --test lib/engineering/files.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildFileTree,
  createTtlCache,
  isSafeWorkspacePath,
  languageForPath,
  parseActivityLog,
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

describe("parseActivityLog", () => {
  it("parse les lignes JSONL et ignore le bruit", () => {
    const text =
      '{"ts":"2026-01-01T00:00:00Z","tool":"github_fork","message":"Forking o/r...","ok":true}\n' +
      "not json\n" +
      '{"tool":"x"}\n' +
      '{"ts":"2026-01-01T00:00:01Z","tool":"github_clone","message":"Clone failed: nope","ok":false}\n';
    const entries = parseActivityLog(text);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].tool, "github_fork");
    assert.equal(entries[0].message, "Forking o/r...");
    assert.equal(entries[0].ok, true);
    assert.equal(entries[1].ok, false);
  });

  it("garde les dernieres lignes selon la limite", () => {
    const text = [1, 2, 3, 4, 5]
      .map((n) => `{"tool":"t","message":"m${n}","ok":true}`)
      .join("\n");
    const entries = parseActivityLog(text, 2);
    assert.deepEqual(
      entries.map((e) => e.message),
      ["m4", "m5"]
    );
  });
});

describe("createTtlCache", () => {
  it("retourne la valeur avant expiration", () => {
    let clock = 1000;
    const cache = createTtlCache<string>(5000, () => clock);
    assert.equal(cache.get("a"), undefined);
    cache.set("a", "v");
    clock += 4999;
    assert.equal(cache.get("a"), "v");
  });

  it("expire apres le TTL et isole les cles", () => {
    let clock = 0;
    const cache = createTtlCache<string>(100, () => clock);
    cache.set("a", "va");
    cache.set("b", "vb");
    clock += 100;
    assert.equal(cache.get("a"), undefined);
    assert.equal(cache.get("b"), undefined);
    cache.set("a", "va2");
    assert.equal(cache.get("a"), "va2");
    assert.equal(cache.get("b"), undefined);
  });

  it("clear vide le cache", () => {
    const cache = createTtlCache<string>(60000);
    cache.set("a", "v");
    cache.clear();
    assert.equal(cache.get("a"), undefined);
  });
});

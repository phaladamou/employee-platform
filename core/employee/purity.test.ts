import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

// Dependances externes autorisees dans le module : les builtins Node,
// le runner de test, et dotenv (CLI uniquement, pour .env.local).
const ALLOWED_BARE_IMPORTS = new Set(["vitest", "dotenv"]);

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

function importSpecifiers(source: string): string[] {
  const found: string[] = [];
  // Ancres en debut de ligne et bornees au point-virgule : les appels
  // multilignes sont couverts, les template literals ne peuvent pas
  // produire de faux positif.
  const pattern =
    /^\s*(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    found.push(match[1]);
  }

  return found;
}

describe("employee module purity", () => {
  const files = listFiles(MODULE_DIR).filter((file) =>
    file.endsWith(".ts")
  );

  it("imports nothing from the app, the framework or sibling core modules", () => {
    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");

      for (const specifier of importSpecifiers(source)) {
        if (specifier.startsWith("node:")) {
          continue;
        }
        if (ALLOWED_BARE_IMPORTS.has(specifier)) {
          continue;
        }
        if (specifier.startsWith("./") || specifier.startsWith("../")) {
          const resolved = resolve(dirname(file), specifier);
          if (
            resolved === MODULE_DIR ||
            resolved.startsWith(`${MODULE_DIR}/`)
          ) {
            continue;
          }
          violations.push(`${file}: escapes the module (${specifier})`);
          continue;
        }
        violations.push(`${file}: forbidden import (${specifier})`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("reads process.env only in the CLI entry point", () => {
    const violations = files
      .filter((file) => !file.endsWith("cli.ts"))
      .filter((file) => !file.endsWith("purity.test.ts"))
      .filter((file) => readFileSync(file, "utf8").includes("process.env"));

    expect(violations).toEqual([]);
  });
});

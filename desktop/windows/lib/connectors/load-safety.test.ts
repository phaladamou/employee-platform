// lib/connectors/load-safety.test.ts
// Execution : node --test lib/connectors/load-safety.test.ts
// Garde anti-regression : les routes API connecteurs ne doivent
// jamais importer le crypto (ni le barrel qui le re-exporte)
// statiquement — sans cles OAUTH_*, le module jette au chargement
// et le build plante. Meme regle que pour la route chat GitHub :
// imports directs + import paresseux dans le handler.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const ROUTES = [
  "app/(chat)/api/connectors/route.ts",
  "app/(chat)/api/connectors/[provider]/connect/route.ts",
  "app/(chat)/api/connectors/[provider]/callback/route.ts",
  "app/(chat)/api/connectors/[provider]/disconnect/route.ts",
];

describe("connector routes avoid load-time crypto", () => {
  for (const route of ROUTES) {
    it(`${route} has no static crypto import`, () => {
      const source = readFileSync(join(REPO_ROOT, route), "utf8");
      assert.ok(source.length > 0, "route source should be readable");
      for (const line of source.split("\n")) {
        const trimmed = line.trim();
        const isImport =
          trimmed.startsWith("import ") || trimmed.startsWith("} from ");
        if (!isImport) {
          continue;
        }
        // Le barrel re-exporte ./core/crypto : l'importer (en valeur)
        // evalue le garde au chargement. Les `import type` sont effaces
        // a la compilation et restent autorises.
        if (trimmed.startsWith("import type ")) {
          continue;
        }
        assert.doesNotMatch(
          trimmed,
          /from "@\/lib\/connectors"/,
          "static barrel import evaluates the crypto guard at load"
        );
        assert.doesNotMatch(
          trimmed,
          /connectors\/core\/crypto/,
          "static crypto import throws at load without OAUTH_* keys"
        );
      }
    });
  }
});

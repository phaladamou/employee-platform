// lib/cli/parser.ts
// Decoupage pur d'une ligne de commande (sans dependance Next ni DB).
// Regles : espaces separateurs, quotes simples/doubles groupantes,
// backslash d'echappement, flags `--cle valeur` / `--cle=valeur` / `--flag`.

export interface ParsedLine {
  name: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

export type TokenizeResult =
  | { ok: true; tokens: string[] }
  | { ok: false; error: string };

export function tokenize(line: string): TokenizeResult {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  let hasCurrent = false;

  for (const char of line) {
    if (escaped) {
      current += char;
      escaped = false;
      hasCurrent = true;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      hasCurrent = true;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      hasCurrent = true;
      continue;
    }
    if (char === " " || char === "\t" || char === "\n") {
      if (hasCurrent) {
        tokens.push(current);
        current = "";
        hasCurrent = false;
      }
      continue;
    }
    current += char;
    hasCurrent = true;
  }

  if (escaped) {
    // Backslash final : litteral, pas d'erreur.
    tokens.push(`${current}\\`);
    return { ok: true, tokens };
  }
  if (quote) {
    return { ok: false, error: "Unterminated quote" };
  }
  if (hasCurrent) {
    tokens.push(current);
  }
  return { ok: true, tokens };
}

export type ParseResult =
  | { ok: true; command: ParsedLine }
  | { ok: false; error: string };

export function parseLine(line: string): ParseResult {
  const tokenized = tokenize(line);
  // Note : `=== false` explicite, le repo compile sans strictNullChecks
  // et `!x.ok` ne narrow pas les unions discriminees dans ce mode.
  if (tokenized.ok === false) {
    return { ok: false, error: tokenized.error };
  }
  const [rawName, ...rest] = tokenized.tokens;
  if (!rawName) {
    return { ok: false, error: "Empty command" };
  }

  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let onlyArgs = false;

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!onlyArgs && token === "--") {
      onlyArgs = true;
      continue;
    }
    if (!onlyArgs && token.startsWith("--") && token.length > 2) {
      const body = token.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
      } else {
        const next = rest[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[body] = next;
          i++;
        } else {
          flags[body] = true;
        }
      }
      continue;
    }
    args.push(token);
  }

  return { ok: true, command: { name: rawName.toLowerCase(), args, flags } };
}

// core/employee/computer/command-policy.ts
//
// Politique d'execution shell d'un Mini-Ordinateur : decoupe une
// commande en segments, extrait chaque binaire invoque, et refuse
// tout ce qui n'est ni liste ni builtin pur. Pur et sans dependance
// (testable seul, importable par run_shell sans cycle).
//
// Couverture honnete, pas une preuve formelle :
// - Operateurs && || ; | & ( ) et retours ligne, hors quotes.
// - Substitutions $(...) et `...` analysees recursivement ; $((...))
//   et ${...} ignores (pas d'execution).
// - Commentaires #... retires (hors quotes).
// - Mots-cles if/for/while and co. sautes (pas des binaires).
// Limites connues (fail-closed, documentees, pas silencieuses) :
// - `case`/`select` et heredocs <<EOF : faux refus possibles.
// - Evasion par binaire autorise (ex. `python3 -c "import os, ..."`)
//   : le controle porte sur l'invocation de premier niveau, pas sur
//   les sous-processus. Un vrai confinement exigerait un LSM/seccomp
//   ou un conteneur.

/** Tetes de boucle/cas : le segment ne contient aucune commande. */
const HEADER_KEYWORDS = new Set(["for", "select", "case"]);

/** Mots-cles sautes avant de lire la commande du segment. */
const SKIP_KEYWORDS = new Set([
  "!",
  "{",
  "}",
  "]",
  "do",
  "done",
  "elif",
  "else",
  "esac",
  "fi",
  "function",
  "if",
  "in",
  "then",
  "until",
  "while",
]);

/** Prefixes transparents : la commande controlee suit (ex. `!`, `env`). */
const PREFIX_COMMANDS = new Set(["command", "env", "exec", "nohup", "time"]);

/**
 * Builtins dash incapables d'executer un binaire externe, toujours
 * autorises (refuser `echo` ou `cd` casserait tout enchainement sans
 * rien proteger). Exclus deliberement : eval, source/., trap (exec
 * differe ou de fichier), bg/fg (controle de taches, fail-closed).
 */
const PURE_BUILTINS = new Set([
  ":",
  "[",
  "alias",
  "break",
  "cd",
  "continue",
  "echo",
  "exit",
  "export",
  "false",
  "getopts",
  "hash",
  "jobs",
  "kill",
  "local",
  "printf",
  "pwd",
  "read",
  "readonly",
  "return",
  "set",
  "shift",
  "test",
  "true",
  "type",
  "ulimit",
  "umask",
  "unalias",
  "unset",
  "wait",
]);

const ASSIGNMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*=/;

function isOperator(char: string): boolean {
  return (
    char === ";" ||
    char === "&" ||
    char === "|" ||
    char === "(" ||
    char === ")" ||
    char === "\n"
  );
}

/** Retire les commentaires sh (# en debut de mot, hors quotes). */
function stripComments(command: string): string {
  return command
    .split("\n")
    .map((line) => {
      let out = "";
      let quote: "'" | '"' | null = null;
      let escaped = false;
      let atWordStart = true;
      for (const char of line) {
        if (escaped) {
          out += char;
          escaped = false;
          atWordStart = false;
          continue;
        }
        if (quote === "'") {
          out += char;
          if (char === "'") {
            quote = null;
          }
          atWordStart = false;
          continue;
        }
        if (char === "\\") {
          out += char;
          escaped = true;
          continue;
        }
        if ((char === "'" || char === '"') && quote === null) {
          out += char;
          quote = char;
          atWordStart = false;
          continue;
        }
        if (char === quote) {
          out += char;
          quote = null;
          atWordStart = false;
          continue;
        }
        if (quote === null && char === "#" && atWordStart) {
          break;
        }
        out += char;
        atWordStart = char === " " || char === "\t";
      }
      return out;
    })
    .join("\n");
}

interface TopLevelSplit {
  readonly segments: string[];
  readonly substitutions: string[];
}

/**
 * Decoupe un niveau : segments separes par les operateurs, corps des
 * substitutions $(...) et `...` mis de cote pour analyse recursive.
 * $((...)) arithmetique consomme sans analyse (pas d'execution).
 */
function splitTopLevel(source: string): TopLevelSplit {
  const segments: string[] = [];
  const substitutions: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  let index = 0;

  const push = () => {
    const trimmed = current.trim();
    if (trimmed) {
      segments.push(trimmed);
    }
    current = "";
  };

  const consumeArithmetic = () => {
    // Positionne sur "$(", suivi de "(" : consomme en equilibre en
    // preservant le texte (pas d'execution, pas d'analyse).
    let depth = 1;
    let cursor = index + 2;
    let innerQuote: "'" | '"' | null = null;
    let innerEscaped = false;
    while (cursor < source.length && depth > 0) {
      const char = source[cursor];
      if (innerEscaped) {
        innerEscaped = false;
        cursor += 1;
        continue;
      }
      if (innerQuote === "'") {
        if (char === "'") {
          innerQuote = null;
        }
        cursor += 1;
        continue;
      }
      if (char === "\\") {
        innerEscaped = true;
        cursor += 1;
        continue;
      }
      if ((char === "'" || char === '"') && innerQuote === null) {
        innerQuote = char;
        cursor += 1;
        continue;
      }
      if (char === innerQuote) {
        innerQuote = null;
        cursor += 1;
        continue;
      }
      if (innerQuote === null && char === "(") {
        depth += 1;
      }
      if (innerQuote === null && char === ")") {
        depth -= 1;
      }
      cursor += 1;
    }
    current += source.slice(index, cursor);
    index = cursor;
  };

  const consumeSubstitution = () => {
    // Positionne sur "$(" : extrait le corps en equilibre.
    let depth = 1;
    let cursor = index + 2;
    let inner = "";
    let innerQuote: "'" | '"' | null = null;
    let innerEscaped = false;
    while (cursor < source.length && depth > 0) {
      const char = source[cursor];
      if (innerEscaped) {
        inner += char;
        innerEscaped = false;
        cursor += 1;
        continue;
      }
      if (innerQuote === "'") {
        inner += char;
        if (char === "'") {
          innerQuote = null;
        }
        cursor += 1;
        continue;
      }
      if (char === "\\") {
        inner += char;
        innerEscaped = true;
        cursor += 1;
        continue;
      }
      if ((char === "'" || char === '"') && innerQuote === null) {
        inner += char;
        innerQuote = char;
        cursor += 1;
        continue;
      }
      if (char === innerQuote) {
        inner += char;
        innerQuote = null;
        cursor += 1;
        continue;
      }
      if (innerQuote === null && char === "(") {
        depth += 1;
        inner += char;
        cursor += 1;
        continue;
      }
      if (innerQuote === null && char === ")") {
        depth -= 1;
        if (depth === 0) {
          cursor += 1;
          break;
        }
        inner += char;
        cursor += 1;
        continue;
      }
      inner += char;
      cursor += 1;
    }
    substitutions.push(inner);
    index = cursor;
  };

  const consumeBackticks = () => {
    // Positionne sur "`" : extrait jusqu'au "`" fermant non echappe.
    let cursor = index + 1;
    let inner = "";
    let innerEscaped = false;
    while (cursor < source.length) {
      const char = source[cursor];
      if (innerEscaped) {
        inner += char;
        innerEscaped = false;
        cursor += 1;
        continue;
      }
      if (char === "\\") {
        inner += char;
        innerEscaped = true;
        cursor += 1;
        continue;
      }
      if (char === "`") {
        cursor += 1;
        break;
      }
      inner += char;
      cursor += 1;
    }
    substitutions.push(inner);
    index = cursor;
  };

  while (index < source.length) {
    const char = source[index];
    if (escaped) {
      current += char;
      escaped = false;
      index += 1;
      continue;
    }
    if (quote === "'") {
      current += char;
      if (char === "'") {
        quote = null;
      }
      index += 1;
      continue;
    }
    if (char === "\\") {
      current += char;
      escaped = true;
      index += 1;
      continue;
    }
    if (char === "'" && quote === null) {
      current += char;
      quote = "'";
      index += 1;
      continue;
    }
    if (char === '"') {
      current += char;
      quote = quote === '"' ? null : '"';
      index += 1;
      continue;
    }
    // Les substitutions s'executent aussi entre doubles quotes.
    if (char === "$" && source[index + 1] === "(") {
      if (source[index + 2] === "(") {
        consumeArithmetic();
      } else {
        consumeSubstitution();
      }
      continue;
    }
    if (char === "`") {
      consumeBackticks();
      continue;
    }
    if (quote === null && isOperator(char)) {
      push();
      index += 1;
      continue;
    }
    current += char;
    index += 1;
  }
  push();
  return { segments, substitutions };
}

/**
 * Decoupe une commande en segments verifiables : separation sur les
 * operateurs shell + corps des substitutions, recursivement.
 */
export function splitShellSegments(command: string): string[] {
  const collected: string[] = [];
  const queue = [stripComments(command)];
  while (queue.length > 0) {
    const next = queue.shift() as string;
    const { segments, substitutions } = splitTopLevel(next);
    collected.push(...segments);
    queue.push(...substitutions);
  }
  return collected;
}

/**
 * Tokenise un segment en mots shell (runs quotes/non-quotes adjacents
 * concatenes, comme le shell : 'py'thon3 vaut python3). Approximation
 * sure entre doubles quotes (sh n'y specialise \ que devant $ ` " \
 * et saut de ligne) : toute divergence produit un nom a backslash,
 * qu'aucun binaire ne porte — echec d'execution, jamais contournement.
 */
function tokenizeWords(segment: string): string[] {
  const words: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  let hasContent = false;

  const push = () => {
    if (hasContent) {
      words.push(current);
    }
    current = "";
    hasContent = false;
  };

  for (const char of segment) {
    if (escaped) {
      current += char;
      escaped = false;
      hasContent = true;
      continue;
    }
    if (quote === "'") {
      if (char === "'") {
        quote = null;
      } else {
        current += char;
      }
      hasContent = true;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if ((char === "'" || char === '"') && quote === null) {
      quote = char;
      hasContent = true;
      continue;
    }
    if (char === quote) {
      quote = null;
      continue;
    }
    if (quote === null && (char === " " || char === "\t")) {
      push();
      continue;
    }
    current += char;
    hasContent = true;
  }
  push();
  return words;
}

function basenameOf(word: string): string {
  const slash = word.lastIndexOf("/");
  const backslash = word.lastIndexOf("\\");
  return word.slice(Math.max(slash, backslash) + 1);
}

/**
 * Premier binaire externe d'un segment, ou null (segment sans commande :
 * vide, tete de boucle, mot-cle seul). Les assignations initiales
 * (VAR=x), mots-cles et prefixes transparents sont sautes.
 */
export function firstBinaryOfSegment(segment: string): string | null {
  const words = tokenizeWords(segment);
  let index = 0;
  for (;;) {
    while (index < words.length && ASSIGNMENT_PATTERN.test(words[index])) {
      index += 1;
    }
    const word = words[index];
    if (word === undefined) {
      return null;
    }
    if (HEADER_KEYWORDS.has(word)) {
      return null;
    }
    if (SKIP_KEYWORDS.has(word)) {
      index += 1;
      continue;
    }
    if (word === "time" || word === "env") {
      index += 1;
      while (
        index < words.length &&
        words[index].startsWith("-") &&
        words[index].length > 1
      ) {
        index += 1;
      }
      continue;
    }
    if (PREFIX_COMMANDS.has(word)) {
      index += 1;
      continue;
    }
    const base = basenameOf(word);
    return base ? base : null;
  }
}

/** Tous les binaires externes invoques par une commande shell. */
export function invokedBinaries(command: string): string[] {
  const names: string[] = [];
  for (const segment of splitShellSegments(command)) {
    const binary = firstBinaryOfSegment(segment);
    if (binary !== null) {
      names.push(binary);
    }
  }
  return names;
}

/**
 * Refuse toute commande invoquant un binaire hors liste (builtins purs
 * toujours admis, voir PURE_BUILTINS). Comparaison exacte, sensible a
 * la casse, sur le nom de base (/usr/bin/x vaut x). Leve une Error au
 * message stable (contrat teste, repris tel quel par run_shell).
 */
export function assertBinariesAllowed(
  command: string,
  allowedBinaries: readonly string[]
): void {
  const allowed = new Set(allowedBinaries);
  for (const name of invokedBinaries(command)) {
    if (allowed.has(name) || PURE_BUILTINS.has(name)) {
      continue;
    }
    const list = allowedBinaries.length > 0 ? allowedBinaries.join(", ") : "none";
    throw new Error(
      `command blocked: binary "${name}" is not allowed (allowed binaries: ${list})`
    );
  }
}

/**
 * Borne memoire (espace d'adressage, Kio) via ulimit POSIX, prefixe
 * neutre en sortie : reussi silencieusement, echoue sans bloquer la
 * commande (le shell est neuf, l'abaissement passe en pratique).
 */
export function withMemoryLimit(command: string, maxMemoryMb: number): string {
  return `ulimit -v ${maxMemoryMb * 1024}; ${command}`;
}

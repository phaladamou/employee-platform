// lib/engineering/cli-commands.ts
// Parseur pur des commandes du mini-CLI web (FR + EN).
// Execution : node --test lib/engineering/cli-commands.test.ts

export type CliCommand =
  | { kind: "empty" }
  | { kind: "help" }
  | { kind: "clear" }
  | { kind: "employees" }
  | { kind: "missions" }
  | { kind: "recruit"; talentSpec: string }
  | { kind: "submit"; employeeId: string; prompt: string }
  | { kind: "unknown"; raw: string };

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

export function parseCliCommand(input: string): CliCommand {
  const raw = input.trim();
  if (!raw) return { kind: "empty" };
  const tokens = tokenize(raw);
  const verb = (tokens[0] ?? "").toLowerCase();

  if (verb === "help" || verb === "aide" || verb === "?") return { kind: "help" };
  if (verb === "clear" || verb === "cls") return { kind: "clear" };
  if (
    verb === "employees" ||
    verb === "employes" ||
    verb === "employés" ||
    verb === "ls"
  ) {
    return { kind: "employees" };
  }
  if (verb === "missions") return { kind: "missions" };

  if (verb === "recruit" || verb === "recruter" || verb === "hire") {
    const talentSpec = tokens[1];
    if (!talentSpec) return { kind: "unknown", raw };
    return { kind: "recruit", talentSpec };
  }

  if (verb === "submit" || verb === "soumettre" || verb === "mission") {
    const employeeId = tokens[1];
    const prompt = tokens.slice(2).join(" ").trim();
    if (!employeeId || !prompt) return { kind: "unknown", raw };
    return { kind: "submit", employeeId, prompt };
  }

  return { kind: "unknown", raw };
}

export const CLI_HELP_LINES: string[] = [
  "Commandes :",
  "  employees — lister les employés",
  "  recruit <talentSpec> — recruter (ex: recruit atlas-software-engineer)",
  '  submit <employeeId> "<prompt>" — donner une mission',
  "  missions — lister les missions récentes",
  "  clear — effacer l'écran",
];

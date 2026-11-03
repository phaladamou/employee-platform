// lib/cli/commands.ts
// Registre pur des commandes du terminal web (allowlist stricte).
// Aucune execution ici : la route API tranche et interroge la DB.

export type CommandKind = "read" | "write";

export interface CommandSpec {
  name: string;
  usage: string;
  description: string;
  kind: CommandKind;
}

export const COMMANDS: readonly CommandSpec[] = [
  {
    name: "help",
    usage: "help [command]",
    description: "Show this help or the usage of one command.",
    kind: "read",
  },
  {
    name: "status",
    usage: "status",
    description: "Show an overview of your employees and missions.",
    kind: "read",
  },
  {
    name: "employees",
    usage: "employees",
    description: "List your hired employees.",
    kind: "read",
  },
  {
    name: "missions",
    usage: "missions [limit]",
    description: "List your recent missions (default 10, max 50).",
    kind: "read",
  },
  {
    name: "talents",
    usage: "talents",
    description: "List the Talent Network catalog and hired marks.",
    kind: "read",
  },
];

export function getCommand(name: string): CommandSpec | null {
  return COMMANDS.find((spec) => spec.name === name) ?? null;
}

export function helpText(name?: string): string {
  if (name) {
    const spec = getCommand(name);
    if (!spec) {
      return `Unknown command: ${name}\nType "help" to list commands.`;
    }
    return `${spec.usage}\n  ${spec.description}`;
  }
  const lines = COMMANDS.map(
    (spec) => `  ${spec.usage.padEnd(22)} ${spec.description}`
  );
  return ["Available commands:", ...lines].join("\n");
}

export type MissionsArgsResult =
  | { ok: true; limit: number }
  | { ok: false; error: string };

export function parseMissionsArgs(args: string[]): MissionsArgsResult {
  if (args.length === 0) {
    return { ok: true, limit: 10 };
  }
  if (args.length > 1) {
    return { ok: false, error: `Usage: ${getCommand("missions")?.usage}` };
  }
  const limit = Number(args[0]);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return { ok: false, error: "Limit must be an integer between 1 and 50." };
  }
  return { ok: true, limit };
}

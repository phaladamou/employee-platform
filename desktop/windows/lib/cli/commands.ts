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
  {
    name: "hire",
    usage: "hire <spec>",
    description: "Hire a talent from the catalog (asks confirmation).",
    kind: "write",
  },
  {
    name: "submit",
    usage: 'submit <employee> --title "..." --prompt "..."',
    description: "Submit a mission to one of your employees (asks confirmation).",
    kind: "write",
  },
  {
    name: "cancel",
    usage: "cancel <mission-id>",
    description: "Cancel a queued or running mission (asks confirmation).",
    kind: "write",
  },
  {
    name: "confirm",
    usage: "confirm <token>",
    description: "Confirm a pending write command.",
    kind: "write",
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

export const MAX_TITLE_LENGTH = 200;
export const MAX_PROMPT_LENGTH = 4000;

export interface SubmitArgs {
  employeeRef: string;
  title: string;
  prompt: string;
  expectFile: string | null;
  expectTest: boolean;
}

export type SubmitArgsResult =
  | { ok: true; args: SubmitArgs }
  | { ok: false; error: string };

const SUBMIT_FLAGS = ["title", "prompt", "expect-file", "expect-test"];

export function parseSubmitArgs(
  args: string[],
  flags: Record<string, string | boolean>
): SubmitArgsResult {
  const usage = `Usage: ${getCommand("submit")?.usage}`;
  if (args.length !== 1 || !args[0]) {
    return { ok: false, error: usage };
  }
  for (const key of Object.keys(flags)) {
    if (!SUBMIT_FLAGS.includes(key)) {
      return { ok: false, error: `Unknown flag: --${key}\n${usage}` };
    }
  }
  const title = flags["title"];
  const prompt = flags["prompt"];
  if (typeof title !== "string" || title.trim().length === 0) {
    return { ok: false, error: `Missing --title.\n${usage}` };
  }
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return { ok: false, error: `Missing --prompt.\n${usage}` };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Title too long (max ${MAX_TITLE_LENGTH} chars).`,
    };
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return {
      ok: false,
      error: `Prompt too long (max ${MAX_PROMPT_LENGTH} chars).`,
    };
  }
  const expectFile = flags["expect-file"];
  if (expectFile !== undefined && typeof expectFile !== "string") {
    return { ok: false, error: "--expect-file needs a value." };
  }
  const expectTest = flags["expect-test"];
  if (expectTest !== undefined && expectTest !== true) {
    return { ok: false, error: "--expect-test takes no value." };
  }
  return {
    ok: true,
    args: {
      employeeRef: args[0],
      title: title.trim(),
      prompt: prompt.trim(),
      expectFile:
        typeof expectFile === "string" && expectFile.length > 0
          ? expectFile
          : null,
      expectTest: expectTest === true,
    },
  };
}

export type HireArgsResult =
  | { ok: true; spec: string }
  | { ok: false; error: string };

export function parseHireArgs(
  args: string[],
  flags: Record<string, string | boolean>
): HireArgsResult {
  const usage = `Usage: ${getCommand("hire")?.usage}`;
  if (args.length !== 1 || !args[0] || Object.keys(flags).length > 0) {
    return { ok: false, error: usage };
  }
  return { ok: true, spec: args[0] };
}

export type CancelArgsResult =
  | { ok: true; missionRef: string }
  | { ok: false; error: string };

export function parseCancelArgs(
  args: string[],
  flags: Record<string, string | boolean>
): CancelArgsResult {
  const usage = `Usage: ${getCommand("cancel")?.usage}`;
  if (args.length !== 1 || !args[0] || Object.keys(flags).length > 0) {
    return { ok: false, error: usage };
  }
  return { ok: true, missionRef: args[0] };
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

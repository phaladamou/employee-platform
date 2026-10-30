import { exec } from "node:child_process";
import { promisify } from "node:util";

import {
  toolFail,
  toolOk,
  type EmployeeTool,
  type ToolArgs,
  type ToolContext,
} from "./tool";

const execAsync = promisify(exec);

export const RUN_SHELL_DEFAULT_TIMEOUT_MS = 30_000;
export const RUN_SHELL_MAX_TIMEOUT_MS = 120_000;
export const RUN_SHELL_MAX_BUFFER = 200_000;

interface ExecFailure extends Error {
  readonly code?: unknown;
  readonly killed?: boolean;
  readonly signal?: unknown;
  readonly stdout?: unknown;
  readonly stderr?: unknown;
}

function combineOutput(stdout: string, stderr: string): string {
  const out = stdout.trimEnd();
  const err = stderr.trimEnd();

  if (!out && !err) {
    return "(no output)";
  }
  if (!err) {
    return out;
  }
  if (!out) {
    return `[stderr]\n${err}`;
  }

  return `${out}\n[stderr]\n${err}`;
}

/**
 * Execute une commande systeme avec le workspace comme dossier courant.
 *
 * Perimetre de confinement, sans promesse excessive : repertoire de
 * depart confine (cwd), delai borne, sortie bornee, et environnement
 * JAMAIS herite du processus hote (vide sauf variables explicitement
 * fournies dans le contexte). En revanche ce n'est PAS une jail :
 * chemins absolus, `cd ..`, acces reseau et appels systeme restent
 * possibles depuis le shell. Ne jamais exposer a des prompts non
 * fiables sans supervision ; un vrai isolement exigerait un conteneur.
 */
export function createRunShellTool(): EmployeeTool {
  return {
    name: "run_shell",
    description:
      "Run a system command with the workspace as working directory and " +
      "return its output. Commands run with an empty environment unless " +
      "the host provides variables; use absolute binary paths when unsure. " +
      "Fails on non-zero exit, timeout or oversized output.",
    argsDescription:
      '{ "command": "<shell command>", "timeoutMs": <optional ms> }',
    async execute(
      args: ToolArgs,
      ctx: ToolContext
    ): Promise<{ ok: boolean; output: string }> {
      if (typeof args.command !== "string" || args.command.length === 0) {
        return toolFail('run_shell requires a "command" string argument');
      }

      let timeout = RUN_SHELL_DEFAULT_TIMEOUT_MS;

      if (args.timeoutMs !== undefined) {
        if (
          typeof args.timeoutMs !== "number" ||
          !Number.isFinite(args.timeoutMs) ||
          args.timeoutMs <= 0
        ) {
          return toolFail("timeoutMs must be a positive number");
        }
        timeout = Math.min(args.timeoutMs, RUN_SHELL_MAX_TIMEOUT_MS);
      }

      try {
        const { stdout, stderr } = await execAsync(args.command, {
          cwd: ctx.sandboxRoot,
          timeout,
          maxBuffer: RUN_SHELL_MAX_BUFFER,
          windowsHide: true,
          // Partiel par design (pas d'heritage) : le cast compense
          // l'exigence de typage NODE_ENV, sans effet au runtime.
          env: { ...ctx.env } as NodeJS.ProcessEnv,
        });

        return toolOk(combineOutput(stdout, stderr));
      } catch (error) {
        const failure = error as ExecFailure;

        if (failure.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
          return toolFail(
            `output exceeded ${RUN_SHELL_MAX_BUFFER} bytes, command killed`
          );
        }
        if (failure.killed === true) {
          return toolFail(`command timed out after ${timeout} ms`);
        }

        const code =
          typeof failure.code === "number"
            ? `exit code ${failure.code}`
            : "failed command";
        const details = combineOutput(
          typeof failure.stdout === "string" ? failure.stdout : "",
          typeof failure.stderr === "string" ? failure.stderr : ""
        );

        return toolFail(`${code}: ${args.command}\n${details}`);
      }
    },
  };
}

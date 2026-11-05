import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";

import { appendActivity } from "./activity";
import {
  assertBinariesAllowed,
  withMemoryLimit,
} from "../computer/command-policy";
import {
  toolFail,
  toolOk,
  toolRoot,
  type EmployeeTool,
  type ToolArgs,
  type ToolContext,
} from "./tool";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export const RUN_SHELL_DEFAULT_TIMEOUT_MS = 30_000;
export const RUN_SHELL_MAX_TIMEOUT_MS = 300_000;
export const RUN_SHELL_MAX_BUFFER = 200_000;
/** Grace ajoutee au timeout pour le pont lui-meme (tuer un binaire bloque). */
const SANDBOX_BRIDGE_GRACE_MS = 5_000;
/** Le rapport JSON echappe la sortie : marge large, jamais bloquante. */
const SANDBOX_BRIDGE_MAX_BUFFER = 1_000_000;

interface ExecFailure extends Error {
  readonly code?: unknown;
  readonly killed?: boolean;
  readonly signal?: unknown;
  readonly stdout?: unknown;
  readonly stderr?: unknown;
}

/** Rapport JSON d'emp-sandbox (voir rust/src/bin/emp-sandbox.rs). */
interface SandboxReport {
  readonly exit_code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timed_out: boolean;
  readonly output_truncated: boolean;
}

function isSandboxReport(value: unknown): value is SandboxReport {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const report = value as Record<string, unknown>;
  return (
    (typeof report.exit_code === "number" || report.exit_code === null) &&
    typeof report.stdout === "string" &&
    typeof report.stderr === "string" &&
    typeof report.timed_out === "boolean" &&
    typeof report.output_truncated === "boolean"
  );
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
 * Execute une commande via emp-sandbox (Rust) quand `ctx.sandboxBin`
 * est pose, sinon repli Node `exec`. Retourne null UNIQUEMENT quand
 * le binaire est introuvable (repli appelant) ; toute autre anomalie
 * (rapport invalide, pont bloque, erreur sandbox) est une erreur
 * d'outil fail-closed, jamais un repli silencieux.
 */
async function runViaSandbox(
  command: string,
  timeout: number,
  ctx: ToolContext,
  displayCommand: string = command
): Promise<{ ok: boolean; output: string } | null> {
  const bin = ctx.sandboxBin as string;
  const argv = [
    "--timeout-ms",
    String(timeout),
    "--max-output-bytes",
    String(RUN_SHELL_MAX_BUFFER),
    "--work-dir",
    toolRoot(ctx),
  ];
  for (const [key, value] of Object.entries(ctx.env ?? {})) {
    if (value !== undefined) {
      argv.push("--env", `${key}=${value}`);
    }
  }
  // argv-direct jusqu'au shell (pas d'interpolation) ; le shell reste
  // /bin/sh (unix) : chemin absolu explicite, comme le contrat l'exige.
  argv.push("--", "/bin/sh", "-c", command);

  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(bin, argv, {
      timeout: timeout + SANDBOX_BRIDGE_GRACE_MS,
      maxBuffer: SANDBOX_BRIDGE_MAX_BUFFER,
      windowsHide: true,
    }));
  } catch (error) {
    const failure = error as ExecFailure;
    if (failure.code === "ENOENT" || failure.code === "EACCES") {
      return null;
    }
    if (failure.killed === true) {
      return toolFail(
        `sandbox bridge timed out after ${timeout + SANDBOX_BRIDGE_GRACE_MS} ms`
      );
    }
    const details =
      typeof failure.stderr === "string" && failure.stderr.trim()
        ? failure.stderr.trim()
        : String(failure.message ?? failure);
    return toolFail(`sandbox error: ${details}`);
  }

  let report: unknown;
  try {
    report = JSON.parse(stdout);
  } catch {
    return toolFail("sandbox returned invalid JSON");
  }
  if (!isSandboxReport(report)) {
    return toolFail("sandbox returned an invalid report shape");
  }

  // Mêmes messages que le repli Node : l'observation ne depend pas
  // du backend, seuls les garanties changent (kill strict, rlimits).
  if (report.timed_out) {
    return toolFail(`command timed out after ${timeout} ms`);
  }
  if (report.output_truncated) {
    return toolFail(
      `output exceeded ${RUN_SHELL_MAX_BUFFER} bytes, command killed`
    );
  }
  if (report.exit_code === 0) {
    return toolOk(combineOutput(report.stdout, report.stderr));
  }
  if (report.exit_code === null) {
    return toolFail(
      `command killed: ${displayCommand}\n${combineOutput(report.stdout, report.stderr)}`
    );
  }
  return toolFail(
    `exit code ${report.exit_code}: ${displayCommand}\n${combineOutput(report.stdout, report.stderr)}`
  );
}

/**
 * Execute une commande systeme avec le workspace comme dossier courant.
 *
 * Deux backends, un contrat : `emp-sandbox` (Rust, strict) quand
 * `ctx.sandboxBin` est pose, sinon Node `exec` (repli). Dans les deux
 * cas : repertoire confine (cwd), delai borne, sortie bornee, et
 * environnement JAMAIS herite du processus hote (vide sauf variables
 * explicitement fournies). Chaque appel demarre un shell neuf : ni cd,
 * ni exports, ni taches de fond ne survivent (pas de session
 * persistante — l'exiger serait un changement d'architecture, cote
 * pont Node comme cote emp-sandbox). En revanche ce n'est PAS une jail :
 * chemins absolus, `cd ..`, acces reseau et appels systeme restent
 * possibles depuis le shell. Ne jamais exposer a des prompts non
 * fiables sans supervision ; un vrai isolement exigerait un conteneur.
 *
 * Mini-Ordinateur (ctx.computer) : chaque commande est controlee AVANT
 * execution (binaires listes ou builtins purs, sinon refus franc),
 * bornee au delai du Mini-Ordinateur, et plafonnee en memoire via
 * `ulimit -v` (espace d'adressage). Sans Mini-Ordinateur : comportement
 * historique inchange. Limites honnetes : le controle porte sur
 * l'invocation de premier niveau (un binaire autorise peut lancer des
 * sous-processus, ex. `python3 -c "import os; ..."`), et `networkAccess`
 * reste une politique DECLAREE (pas de netns ici).
 */
export function createRunShellTool(): EmployeeTool {
  return {
    name: "run_shell",
    description:
      "Run a system command with the workspace as working directory and " +
      "return its output. Commands run with an empty environment unless " +
      "the host provides variables; use absolute binary paths when unsure. " +
      "Each call starts a fresh shell: cd, exported variables and background " +
      "jobs do not persist between calls, so chain dependent commands with " +
      "&& in a single call. Fails on non-zero exit, timeout or oversized output.",
    argsDescription:
      '{ "command": "<shell command>", "timeoutMs": <optional ms> }',
    async execute(
      args: ToolArgs,
      ctx: ToolContext
    ): Promise<{ ok: boolean; output: string }> {
      if (typeof args.command !== "string" || args.command.length === 0) {
        return toolFail('run_shell requires a "command" string argument');
      }

      const computer = ctx.computer ?? null;
      if (computer !== null) {
        try {
          assertBinariesAllowed(args.command, computer.allowedBinaries);
        } catch (error) {
          return toolFail(
            error instanceof Error ? error.message : String(error)
          );
        }
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
      if (computer !== null) {
        timeout = Math.min(timeout, computer.maxExecutionTimeMs);
      }

      const execCommand =
        computer !== null
          ? withMemoryLimit(args.command, computer.maxMemoryMb)
          : args.command;

      const preview =
        args.command.length > 120
          ? `${args.command.slice(0, 120)}…`
          : args.command;
      await appendActivity(ctx, "run_shell", `Running: ${preview}`, true);

      if (ctx.sandboxBin) {
        const bridged = await runViaSandbox(
          execCommand,
          timeout,
          ctx,
          args.command
        );
        if (bridged !== null) {
          return bridged;
        }
      }

      try {
        const { stdout, stderr } = await execAsync(execCommand, {
          cwd: toolRoot(ctx),
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

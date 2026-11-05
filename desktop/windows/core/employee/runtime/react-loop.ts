import { mkdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

import type { JobRunSignal } from "../jobs/job-signal";
import type { EmployeeProfile } from "../profile/employee-profile";
import {
  createCoreTools,
  resolveWithinRoot,
  toolRoot,
  type EmployeeTool,
  type ToolContext,
} from "../tools/tool";
import { diffLines, type DiffRow } from "./file-diff";
import type { EmployeeLLMMessage, EmployeeLLMProvider } from "./llm-provider";
import {
  buildSystemPrompt,
  formatObservation,
  parsePlanTurn,
  parseStepOutput,
} from "./react-protocol";

export const DEFAULT_MAX_STEPS = 12;
export const DEFAULT_SANDBOX_DIR = ".data/workspace";
/** Outils dont les ecritures sont suivies (onglet Changes). */
const TRACKED_WRITE_TOOLS = new Set(["write_file"]);
/** Capture du contenu precedent : au-dela, pas de detail (borne memoire). */
const CHANGE_CAPTURE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Lit le contenu actuel d'un fichier du workspace (best-effort :
 * null si absent, hors racine, trop gros ou illisible — l'outil
 * reste seul juge, la boucle ne fait que du suivi).
 */
async function readBeforeContent(
  ctx: ToolContext,
  relPath: string
): Promise<string | null> {
  try {
    const resolved = await resolveWithinRoot(toolRoot(ctx), relPath);
    const info = await stat(resolved);
    if (!info.isFile() || info.size > CHANGE_CAPTURE_MAX_BYTES) {
      return null;
    }
    return await readFile(resolved, "utf8");
  } catch {
    return null;
  }
}

export interface ReactToolCall {
  readonly tool: string;
  readonly ok: boolean;
  /** Titre ecrit par l'agent pour cette etape, null si absent. */
  readonly title: string | null;
  /** Duree de l'appel LLM qui a produit l'action, en millisecondes. */
  readonly thoughtMs: number;
  /** Fichiers modifies (outils d'ecriture), absent sinon. */
  readonly files?: readonly ReactFileChange[];
}

/** Modification d'un fichier du workspace (onglet Changes de l'IDE). */
export interface ReactFileChange {
  /** Chemin relatif au workspace, tel que passe a l'outil. */
  readonly path: string;
  readonly status: "added" | "modified";
  readonly added: number;
  readonly removed: number;
  /** Detail borne (voir file-diff), vide si abandonne. */
  readonly rows: readonly DiffRow[];
  readonly truncated: boolean;
}

/**
 * Evenements live de la boucle, dans l'ordre : `thinking` avant
 * chaque appel LLM, puis `step` (titre agent + outil), puis
 * `tool_result` qui clot l'etape (outil inconnu ou reponse hors
 * protocole = ok:false, l'agent se corrige a l'etape suivante).
 * `plan` (premier tour, optionnel) annonce les etapes ecrites par
 * l'agent avant d'agir.
 * `final` clot sur le rapport, `error` est terminal (panne LLM,
 * boucle epuisee, annulation).
 */
export type ReactLoopEvent =
  | { readonly type: "thinking"; readonly step: number }
  | {
      readonly type: "plan";
      readonly step: number;
      readonly steps: readonly string[];
    }
  | {
      readonly type: "step";
      readonly step: number;
      readonly title: string | null;
      readonly tool: string | null;
      readonly thoughtMs: number;
    }
  | {
      readonly type: "tool_result";
      readonly step: number;
      readonly tool: string;
      readonly ok: boolean;
      readonly files: readonly ReactFileChange[];
    }
  | {
      readonly type: "final";
      readonly step: number;
      readonly title: string | null;
      readonly thoughtMs: number;
    }
  | { readonly type: "error"; readonly step: number; readonly message: string };

export type ReactLoopEventHandler = (
  event: ReactLoopEvent
) => void | Promise<void>;

export interface ReactLoopOptions {
  readonly provider: EmployeeLLMProvider;
  readonly profile: EmployeeProfile;
  readonly missionPrompt: string;
  readonly tools?: readonly EmployeeTool[];
  readonly toolContext?: ToolContext;
  readonly maxSteps?: number;
  /** Resumes de missions passees, rappeles au LLM. */
  readonly pastExperience?: readonly string[];
  /** Prompt de specialisation (profil), sinon identite du profil. */
  readonly systemPrompt?: string;
  /**
   * Signal d'annulation : consulte avant chaque appel LLM. Quand il
   * bascule, la boucle s'interrompt proprement (cancelled: true) sans
   * nouvel appel ni nouvel outil.
   */
  readonly signal?: JobRunSignal;
  /**
   * Observateur live, appele dans l'ordre des evenements (attendu
   * avant de poursuivre : contre-pression naturelle pour le stream).
   * Une erreur du handler interrompt la boucle (erreur de
   * programmation, levee telle quelle).
   */
  readonly onEvent?: ReactLoopEventHandler;
}

export interface ReactLoopResult {
  readonly completed: boolean;
  readonly reportContent: string | null;
  readonly steps: number;
  readonly toolCalls: readonly ReactToolCall[];
  readonly error: string | null;
  /** Vrai si le run a ete interrompu par le signal d'annulation. */
  readonly cancelled: boolean;
  /**
   * Outils tentes mais hors profil (distincts, ordre d'apparition).
   * Signal de moyens manquants pour la revue (needs_review).
   */
  readonly unknownTools: readonly string[];
  /** Tokens cumules sur les appels LLM du run (0 = non mesures). */
  readonly usage: LLMUsageTotal;
}

/** Compteurs cumules d'un run (sommes, jamais null ici). */
export interface LLMUsageTotal {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

/**
 * Boucle de raisonnement ReAct : le LLM emet des ACTION (executees par
 * les outils, resultat renvoye en OBSERVATION) jusqu'au FINAL. Bornee en
 * nombre d'appels LLM, resiliente aux outils inconnus, aux formats
 * invalides et aux pannes d'outils (renvoyes comme observations pour
 * laisser le LLM se corriger). Seule une panne LLM interrompt la boucle.
 */
export async function runReasoningLoop(
  options: ReactLoopOptions
): Promise<ReactLoopResult> {
  const tools = options.tools ?? createCoreTools();
  const ctx =
    options.toolContext ?? { sandboxRoot: resolve(DEFAULT_SANDBOX_DIR) };
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;

  // Racine effective (workspace dedie si pose) : meme point de
  // decision que les outils, jamais sandboxRoot en direct.
  await mkdir(toolRoot(ctx), { recursive: true });

  const messages: EmployeeLLMMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(
        options.profile,
        tools,
        options.pastExperience ?? [],
        options.systemPrompt
      ),
    },
    { role: "user", content: options.missionPrompt },
  ];
  const toolCalls: ReactToolCall[] = [];
  const unknownTools: string[] = [];
  let steps = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  // Total prefere = somme des totaux declares ; repli = entrees +
  // sorties quand le fournisseur ne renvoie que le detail.
  const currentUsage = (): LLMUsageTotal => ({
    inputTokens,
    outputTokens,
    totalTokens: totalTokens > 0 ? totalTokens : inputTokens + outputTokens,
  });

  const notify = async (event: ReactLoopEvent): Promise<void> => {
    await options.onEvent?.(event);
  };

  for (let step = 0; step < maxSteps; step += 1) {
    if (options.signal && (await options.signal.isCancelled())) {
      await notify({ type: "error", step: steps, message: "cancelled" });
      return {
        completed: false,
        reportContent: null,
        steps,
        toolCalls,
        error: "cancelled",
        cancelled: true,
        unknownTools: [...unknownTools],
        usage: currentUsage(),
      };
    }

    let content: string;

    await notify({ type: "thinking", step: steps + 1 });
    const thinkStart = Date.now();
    try {
      const response = await options.provider.generate({ messages });
      content = response.content;
      inputTokens += response.usage?.inputTokens ?? 0;
      outputTokens += response.usage?.outputTokens ?? 0;
      totalTokens += response.usage?.totalTokens ?? 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await notify({ type: "error", step: steps + 1, message });
      return {
        completed: false,
        reportContent: null,
        steps,
        toolCalls,
        error: message,
        cancelled: false,
        unknownTools: [...unknownTools],
        usage: currentUsage(),
      };
    }
    const thoughtMs = Date.now() - thinkStart;

    steps += 1;
    messages.push({ role: "assistant", content });

    // Premier tour : l'agent peut annoncer son plan avant d'agir
    // (tour de reflexion ecrit, comme une liste de taches).
    if (steps === 1) {
      const plan = parsePlanTurn(content);
      if (plan !== null) {
        await notify({ type: "plan", step: steps, steps: plan });
        messages.push({
          role: "user",
          content:
            `OBSERVATION: Plan recorded (${plan.length} steps). Execute step 1 now: ` +
            `reply with STEP: + ACTION: (or FINAL: if no action is needed).`,
        });
        continue;
      }
    }

    const parsed = parseStepOutput(content);

    if (parsed.type === "final") {
      await notify({
        type: "final",
        step: steps,
        title: parsed.title,
        thoughtMs,
      });
      return {
        completed: true,
        reportContent: parsed.report,
        steps,
        toolCalls,
        error: null,
        cancelled: false,
        unknownTools: [...unknownTools],
        usage: currentUsage(),
      };
    }

    if (parsed.type === "action") {
      const tool = tools.find((candidate) => candidate.name === parsed.tool);

      if (!tool) {
        if (!unknownTools.includes(parsed.tool)) {
          unknownTools.push(parsed.tool);
        }
        await notify({
          type: "step",
          step: steps,
          title: parsed.title,
          tool: parsed.tool,
          thoughtMs,
        });
        await notify({
          type: "tool_result",
          step: steps,
          tool: parsed.tool,
          ok: false,
          files: [],
        });
        const names = tools.map((candidate) => candidate.name).join(", ");
        messages.push({
          role: "user",
          content:
            `OBSERVATION (protocol error): unknown tool "${parsed.tool}". ` +
            `Available tools: ${names || "none"}.`,
        });
        continue;
      }

      let ok: boolean;
      let output: string;

      await notify({
        type: "step",
        step: steps,
        title: parsed.title,
        tool: tool.name,
        thoughtMs,
      });
      // Suivi d'ecriture : le contenu precedent est capture avant
      // execution (best-effort), le diff calcule apres succes.
      const writePath =
        TRACKED_WRITE_TOOLS.has(tool.name) &&
        typeof parsed.args["path"] === "string"
          ? (parsed.args["path"] as string)
          : null;
      const beforeContent =
        writePath !== null ? await readBeforeContent(ctx, writePath) : null;
      try {
        const result = await tool.execute(parsed.args, ctx);
        ok = result.ok;
        output = result.output;
      } catch (error) {
        ok = false;
        output = `Error: ${error instanceof Error ? error.message : String(error)}`;
      }

      let files: readonly ReactFileChange[] = [];
      if (ok && writePath !== null) {
        const next = parsed.args["content"];
        if (typeof next === "string") {
          const diff = diffLines(beforeContent ?? "", next);
          files = [
            {
              path: writePath,
              status: beforeContent === null ? "added" : "modified",
              added: diff.added,
              removed: diff.removed,
              rows: diff.rows,
              truncated: diff.truncated,
            },
          ];
        }
      }

      toolCalls.push({
        tool: tool.name,
        ok,
        title: parsed.title,
        thoughtMs,
        ...(files.length > 0 ? { files } : {}),
      });
      await notify({
        type: "tool_result",
        step: steps,
        tool: tool.name,
        ok,
        files,
      });
      messages.push({
        role: "user",
        content: formatObservation(tool.name, ok, output),
      });
      continue;
    }

    await notify({
      type: "step",
      step: steps,
      title: parsed.title,
      tool: null,
      thoughtMs,
    });
    await notify({
      type: "tool_result",
      step: steps,
      tool: "protocol",
      ok: false,
      files: [],
    });
    messages.push({
      role: "user",
      content:
        formatObservation(
          "protocol",
          false,
          `${parsed.reason}. Reply with ACTION: {...} or FINAL: <report>.`
        ),
    });
  }

  const exhausted = `mission not finished after ${maxSteps} steps`;
  await notify({ type: "error", step: steps, message: exhausted });
  return {
    completed: false,
    reportContent: null,
    steps,
    toolCalls,
    error: exhausted,
    cancelled: false,
    unknownTools: [...unknownTools],
    usage: currentUsage(),
  };
}

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import type { EmployeeProfile } from "../profile/employee-profile";
import {
  createCoreTools,
  type EmployeeTool,
  type ToolContext,
} from "../tools/tool";
import type { EmployeeLLMMessage, EmployeeLLMProvider } from "./llm-provider";
import {
  buildSystemPrompt,
  formatObservation,
  parseStepOutput,
} from "./react-protocol";

export const DEFAULT_MAX_STEPS = 12;
export const DEFAULT_SANDBOX_DIR = ".data/workspace";

export interface ReactToolCall {
  readonly tool: string;
  readonly ok: boolean;
}

export interface ReactLoopOptions {
  readonly provider: EmployeeLLMProvider;
  readonly profile: EmployeeProfile;
  readonly missionPrompt: string;
  readonly tools?: readonly EmployeeTool[];
  readonly toolContext?: ToolContext;
  readonly maxSteps?: number;
  /** Resumes de missions passees, rappeles au LLM. */
  readonly pastExperience?: readonly string[];
}

export interface ReactLoopResult {
  readonly completed: boolean;
  readonly reportContent: string | null;
  readonly steps: number;
  readonly toolCalls: readonly ReactToolCall[];
  readonly error: string | null;
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

  await mkdir(ctx.sandboxRoot, { recursive: true });

  const messages: EmployeeLLMMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(
        options.profile,
        tools,
        options.pastExperience ?? []
      ),
    },
    { role: "user", content: options.missionPrompt },
  ];
  const toolCalls: ReactToolCall[] = [];
  let steps = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    let content: string;

    try {
      const response = await options.provider.generate({ messages });
      content = response.content;
    } catch (error) {
      return {
        completed: false,
        reportContent: null,
        steps,
        toolCalls,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    steps += 1;
    messages.push({ role: "assistant", content });

    const parsed = parseStepOutput(content);

    if (parsed.type === "final") {
      return {
        completed: true,
        reportContent: parsed.report,
        steps,
        toolCalls,
        error: null,
      };
    }

    if (parsed.type === "action") {
      const tool = tools.find((candidate) => candidate.name === parsed.tool);

      if (!tool) {
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

      try {
        const result = await tool.execute(parsed.args, ctx);
        ok = result.ok;
        output = result.output;
      } catch (error) {
        ok = false;
        output = `Error: ${error instanceof Error ? error.message : String(error)}`;
      }

      toolCalls.push({ tool: tool.name, ok });
      messages.push({
        role: "user",
        content: formatObservation(tool.name, ok, output),
      });
      continue;
    }

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

  return {
    completed: false,
    reportContent: null,
    steps,
    toolCalls,
    error: `mission not finished after ${maxSteps} steps`,
  };
}

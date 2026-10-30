import {
  setEmployeeStatus,
  type EmployeeProfile,
} from "../profile/employee-profile";
import {
  assignMission,
  completeEmployeeMission,
  failEmployeeMission,
  startEmployeeMission,
  type EmployeeMission,
  type MissionReport,
} from "../missions/employee-mission";
import type { ProfileRegistry } from "../profiles/profile-registry";
import type { EmployeeTool, ToolContext } from "../tools/tool";
import { createCoreTools } from "../tools/tool";
import type { EmployeeMemory } from "../memory/employee-memory";
import type { EmployeeMemoryStore } from "../memory/memory-store";
import type { EmployeeLLMProvider } from "./llm-provider";
import { resolveToolsForProfile } from "./profile-tools";
import { formatSpecializationBlock } from "./react-protocol";
import {
  runReasoningLoop,
  type ReactToolCall,
} from "./react-loop";

export interface EmployeeRunResult {
  readonly profile: EmployeeProfile;
  readonly mission: EmployeeMission;
  readonly report: MissionReport | null;
  readonly error: string | null;
  /** Appels LLM effectues pendant la mission. */
  readonly steps: number;
  /** Outils executes, dans l'ordre. */
  readonly toolCalls: readonly ReactToolCall[];
}

export interface EmployeeRuntimeOptions {
  readonly tools?: readonly EmployeeTool[];
  readonly toolContext?: ToolContext;
  readonly maxSteps?: number;
  /**
   * Registre des specialisations, REQUIS quand l'employe est lie : le
   * run resout la version exacte du binding (jamais "latest") et ignore
   * `tools` (un employeur ne peut ni omettre ni substituer l'ADN).
   * Employe non lie (generaliste) : comportement libre inchange.
   */
  readonly profiles?: ProfileRegistry;
  /**
   * Memoire + backend : quand les deux sont fournis, l'historique est
   * recharge au demarrage et chaque mission terminee est sauvegardee.
   */
  readonly memory?: EmployeeMemory;
  readonly memoryStore?: EmployeeMemoryStore;
}

function summarize(content: string): string {
  const firstLine =
    content
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";

  return firstLine.length > 140
    ? `${firstLine.slice(0, 137)}...`
    : firstLine;
}

/**
 * Moteur d'execution d'un Employee : prend son profil, une mission en
 * attente et un fournisseur LLM injecte, puis pilote une boucle de
 * raisonnement ReAct (outils + observations) jusqu'au rapport final.
 * Ne leve jamais d'exception pour un echec metier (panne LLM, boucle
 * epuisee -> mission failed dans le resultat) ; seules les erreurs de
 * programmation levent (profil suspendu, mission non executable).
 */
export class EmployeeRuntime {
  constructor(
    private readonly provider: EmployeeLLMProvider,
    private readonly options: EmployeeRuntimeOptions = {}
  ) {}

  private async persistMemory(
    profile: EmployeeProfile,
    mission: EmployeeMission
  ): Promise<void> {
    const { memory, memoryStore } = this.options;

    if (!memory || !memoryStore) {
      return;
    }

    memory.record(mission);
    await memoryStore.save(profile.id, memory.history(profile.id));
  }

  async run(
    profile: EmployeeProfile,
    mission: EmployeeMission
  ): Promise<EmployeeRunResult> {
    if (profile.status === "suspended") {
      throw new Error(`Employee ${profile.id} is suspended`);
    }
    if (mission.status !== "pending") {
      throw new Error(
        `Mission ${mission.id} is not pending (status "${mission.status}")`
      );
    }

    const assigned =
      mission.employeeId === null
        ? assignMission(mission, profile.id)
        : mission;

    if (assigned.employeeId !== profile.id) {
      throw new Error(
        `Mission ${mission.id} is assigned to another employee`
      );
    }

    const working = setEmployeeStatus(profile, "working");
    const running = startEmployeeMission(assigned);

    const { memory, memoryStore } = this.options;
    let pastExperience: readonly string[] = [];

    if (memory && memoryStore) {
      memory.restore(await memoryStore.load(profile.id));
      pastExperience = memory
        .history(profile.id)
        .map((record) => record.summary ?? record.prompt);
    }

    // Enforcement du binding AVANT le premier appel LLM : employe
    // lie -> la spec exacte est resolue via le registre, les outils
    // fournis sont ignores, et tout ecart leve franchement.
    const binding = working.specialization;
    let tools = this.options.tools;
    let maxSteps = this.options.maxSteps;
    let systemPrompt: string | undefined;

    if (binding !== null) {
      const registry = this.options.profiles;

      if (!registry) {
        throw new Error(
          `Employee ${profile.id} is bound to "${binding.name}@${binding.version}" but no ProfileRegistry was provided`
        );
      }

      const spec = registry.get(binding.name, binding.version);

      if (!spec) {
        throw new Error(
          `Unknown profile "${binding.name}@${binding.version}" for employee ${profile.id}`
        );
      }

      tools = resolveToolsForProfile(
        spec,
        this.options.tools ?? createCoreTools()
      );
      systemPrompt = formatSpecializationBlock(spec);

      if (maxSteps === undefined) {
        maxSteps = spec.maxSteps;
      } else if (maxSteps > spec.maxSteps) {
        throw new Error(
          `maxSteps ${maxSteps} exceeds profile "${spec.name}" limit ${spec.maxSteps}`
        );
      }
    }

    const loop = await runReasoningLoop({
      provider: this.provider,
      profile: working,
      missionPrompt: running.prompt,
      tools,
      toolContext: this.options.toolContext,
      maxSteps,
      pastExperience,
      systemPrompt,
    });

    if (!loop.completed || loop.reportContent === null) {
      const failed = failEmployeeMission(
        running,
        loop.error ?? "reasoning loop did not complete"
      );
      await this.persistMemory(profile, failed);

      return {
        profile: setEmployeeStatus(working, "idle"),
        mission: failed,
        report: null,
        error: failed.error,
        steps: loop.steps,
        toolCalls: loop.toolCalls,
      };
    }

    const completed = completeEmployeeMission(running, {
      summary: summarize(loop.reportContent),
      content: loop.reportContent,
    });
    await this.persistMemory(profile, completed);

    return {
      profile: setEmployeeStatus(working, "idle"),
      mission: completed,
      report: completed.report,
      error: null,
      steps: loop.steps,
      toolCalls: loop.toolCalls,
    };
  }
}

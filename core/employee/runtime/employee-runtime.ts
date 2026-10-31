import { resolve } from "node:path";

import {
  setEmployeeStatus,
  type EmployeeProfile,
} from "../profile/employee-profile";
import {
  assignMission,
  completeEmployeeMission,
  failEmployeeMission,
  flagMissionForReview,
  startEmployeeMission,
  type EmployeeMission,
  type MissionReport,
} from "../missions/employee-mission";
import {
  verifyAcceptance,
  verifyAcceptanceTests,
} from "../missions/mission-acceptance";
import { RUN_SHELL_MAX_TIMEOUT_MS } from "../tools/run-shell";
import {
  CLAIM_SUPPORT_LABEL,
  detectRefusalAdmission,
  detectUnsupportedClaims,
} from "../missions/mission-claims";
import type { ProfileRegistry } from "../profiles/profile-registry";
import type { EmployeeTool, ToolContext } from "../tools/tool";
import { createCoreTools, toolRoot } from "../tools/tool";
import type { EmployeeMemory } from "../memory/employee-memory";
import {
  LOCAL_EMPLOYER_ID,
  type EmployeeMemoryScope,
  type EmployeeMemoryStore,
} from "../memory/memory-store";
import type { JobRunSignal } from "../jobs/job-signal";
import type { EmployeeLLMProvider } from "./llm-provider";
import { assertSpecEnvironment, resolveToolsForProfile } from "./profile-tools";
import { formatSpecializationBlock } from "./react-protocol";
import {
  DEFAULT_SANDBOX_DIR,
  runReasoningLoop,
  type ReactToolCall,
} from "./react-loop";

export interface EmployeeRunResult {
  readonly profile: EmployeeProfile;
  readonly mission: EmployeeMission;
  readonly report: MissionReport | null;
  readonly error: string | null;
  /** Vrai si le run a ete interrompu par le signal d'annulation. */
  readonly cancelled: boolean;
  /**
   * Vrai si le Final est suspect : outils hors profil tentes sans
   * aucun appel reussi, tous les appels en echec, affirmations
   * d'effets non etayees, ou aveu de non-accomplissement (voir
   * mission-claims). Mission en needs_review, rapport preserve pour
   * le relecteur humain, `reviewReason` explique pourquoi.
   */
  readonly needsReview: boolean;
  readonly reviewReason: string | null;
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
  /**
   * Signal d'annulation : consulte avant chaque pas LLM. Quand il
   * bascule, la mission termine failed "cancelled" (tracee en memoire)
   * et le resultat porte cancelled: true pour que le worker confirme
   * via `markCancelled` plutot que `markFailed`.
   */
  readonly signal?: JobRunSignal;
}

/**
 * Partition memoire d'un run : l'employeur vient de la mission (pose
 * par le serveur depuis le token), `local` sinon (mode mono-tenant).
 */
function scopeFor(
  profile: EmployeeProfile,
  mission: EmployeeMission
): EmployeeMemoryScope {
  return {
    employeeId: profile.id,
    employerId: mission.employerId ?? LOCAL_EMPLOYER_ID,
  };
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

    const scope = scopeFor(profile, mission);

    memory.record(mission);
    await memoryStore.save(scope, memory.history(profile.id, scope.employerId));
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
      const scope = scopeFor(profile, running);
      memory.restore(await memoryStore.load(scope));
      pastExperience = memory
        .history(profile.id, scope.employerId)
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
      await assertSpecEnvironment(spec, this.options.toolContext?.env);
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
      signal: this.options.signal,
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
        cancelled: loop.cancelled,
        needsReview: false,
        reviewReason: null,
      };
    }

    const report = {
      summary: summarize(loop.reportContent),
      content: loop.reportContent,
    };

    // 1. Criteres declares : verification deterministe (fichiers
    //    contre la racine effective, tests via le shell confine).
    //    Un Final qui ne les satisfait pas est un echec, pas un succes.
    const acceptanceTests = running.acceptance.tests ?? [];
    if (running.acceptance.files.length > 0 || acceptanceTests.length > 0) {
      const context = this.options.toolContext;
      const root = context ? toolRoot(context) : resolve(DEFAULT_SANDBOX_DIR);
      const check = await verifyAcceptance(root, running.acceptance);
      const failures = [...check.failures];

      if (acceptanceTests.length > 0) {
        const shell = (tools ?? createCoreTools()).find(
          (tool) => tool.name === "run_shell"
        );
        if (!shell || !context) {
          failures.push(
            "test verification requires the run_shell tool with a tool context"
          );
        } else {
          const testCheck = await verifyAcceptanceTests(
            acceptanceTests,
            (command) =>
              shell.execute(
                { command, timeoutMs: RUN_SHELL_MAX_TIMEOUT_MS },
                context
              )
          );
          failures.push(...testCheck.failures);
        }
      }

      if (failures.length > 0) {
        const failed = failEmployeeMission(
          running,
          `verification failed: ${failures.join("; ")}`
        );
        await this.persistMemory(profile, failed);

        return {
          profile: setEmployeeStatus(working, "idle"),
          mission: failed,
          report: null,
          error: failed.error,
          steps: loop.steps,
          toolCalls: loop.toolCalls,
          cancelled: false,
          needsReview: false,
          reviewReason: null,
        };
      }
    } else if (
      loop.unknownTools.length > 0 &&
      !loop.toolCalls.some((call) => call.ok)
    ) {
      // 2. Sans criteres : l'agent a tendu la main hors de son profil
      //    sans rien accomplir d'observable — jugement suspendu, pas
      //    de succes auto-declare. Le rapport est preserve pour revue.
      const flagged = flagMissionForReview(running, report);
      const reason =
        `reached for unavailable tools (${loop.unknownTools.join(", ")}) ` +
        `with no successful tool calls`;
      await this.persistMemory(profile, flagged);

      return {
        profile: setEmployeeStatus(working, "idle"),
        mission: flagged,
        report: flagged.report,
        error: null,
        steps: loop.steps,
        toolCalls: loop.toolCalls,
        cancelled: false,
        needsReview: true,
        reviewReason: reason,
      };
    } else if (
      loop.toolCalls.length > 0 &&
      !loop.toolCalls.some((call) => call.ok)
    ) {
      // 3. Sans criteres : des outils connus ont ete tentes mais TOUS
      //    ont echoue, Final quand meme — le but n'est pas etabli,
      //    meme si le Final decrit honnetement l'echec.
      const failedTools = [
        ...new Set(loop.toolCalls.map((call) => call.tool)),
      ];
      const flagged = flagMissionForReview(running, report);
      const reason =
        `all tool calls failed with no successful call ` +
        `(${failedTools.join(", ")})`;
      await this.persistMemory(profile, flagged);

      return {
        profile: setEmployeeStatus(working, "idle"),
        mission: flagged,
        report: flagged.report,
        error: null,
        steps: loop.steps,
        toolCalls: loop.toolCalls,
        cancelled: false,
        needsReview: true,
        reviewReason: reason,
      };
    }

    // 4. Sans criteres : le Final affirme-t-il des effets concrets
    //    (fichier, message, commande) qu'aucun appel reussi n'etaye ?
    //    Heuristique fail-soft -> revue humaine, jamais d'echec auto.
    const successfulTools = [
      ...new Set(
        loop.toolCalls.filter((call) => call.ok).map((call) => call.tool)
      ),
    ];
    const unsupported = detectUnsupportedClaims(
      loop.reportContent,
      successfulTools
    );
    if (unsupported.length > 0) {
      const claim = unsupported[0];
      const flagged = flagMissionForReview(running, report);
      const reason =
        `report claims ${claim.category} effects with no supporting ` +
        `${CLAIM_SUPPORT_LABEL[claim.category]}: "${claim.excerpt}"`;
      await this.persistMemory(profile, flagged);

      return {
        profile: setEmployeeStatus(working, "idle"),
        mission: flagged,
        report: flagged.report,
        error: null,
        steps: loop.steps,
        toolCalls: loop.toolCalls,
        cancelled: false,
        needsReview: true,
        reviewReason: reason,
      };
    }

    // 5. Sans criteres : le Final avoue-t-il que le but n'est pas
    //    atteint ("Mission not executed", "could not write...") ? Un
    //    refus honnete reste un but manque : revue, pas succes.
    const refusal = detectRefusalAdmission(loop.reportContent);
    if (refusal !== null) {
      const flagged = flagMissionForReview(running, report);
      const reason =
        `report admits the goal was not accomplished: "${refusal.excerpt}"`;
      await this.persistMemory(profile, flagged);

      return {
        profile: setEmployeeStatus(working, "idle"),
        mission: flagged,
        report: flagged.report,
        error: null,
        steps: loop.steps,
        toolCalls: loop.toolCalls,
        cancelled: false,
        needsReview: true,
        reviewReason: reason,
      };
    }

    const completed = completeEmployeeMission(running, report);
    await this.persistMemory(profile, completed);

    return {
      profile: setEmployeeStatus(working, "idle"),
      mission: completed,
      report: completed.report,
      error: null,
      steps: loop.steps,
      toolCalls: loop.toolCalls,
      cancelled: false,
      needsReview: false,
      reviewReason: null,
    };
  }
}

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
import type { EmployeeLLMProvider } from "./llm-provider";

export interface EmployeeRunResult {
  readonly profile: EmployeeProfile;
  readonly mission: EmployeeMission;
  readonly report: MissionReport | null;
  readonly error: string | null;
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
 * attente et un fournisseur LLM injecte, produit un rapport. Ne leve
 * jamais d'exception pour un echec metier (panne LLM -> mission failed
 * dans le resultat) ; seules les erreurs de programmation levent
 * (profil suspendu, mission non executable).
 */
export class EmployeeRuntime {
  constructor(private readonly provider: EmployeeLLMProvider) {}

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

    try {
      const response = await this.provider.generate({
        messages: [
          {
            role: "system",
            content:
              `You are ${working.name}, ${working.role}. ` +
              `Skills: ${working.skills.join(", ") || "generalist"}. ` +
              "Produce a concise work report.",
          },
          { role: "user", content: running.prompt },
        ],
      });

      const completed = completeEmployeeMission(running, {
        summary: summarize(response.content),
        content: response.content,
      });

      return {
        profile: setEmployeeStatus(working, "idle"),
        mission: completed,
        report: completed.report,
        error: null,
      };
    } catch (error) {
      const failed = failEmployeeMission(
        running,
        error instanceof Error ? error.message : String(error)
      );

      return {
        profile: setEmployeeStatus(working, "idle"),
        mission: failed,
        report: null,
        error: failed.error,
      };
    }
  }
}

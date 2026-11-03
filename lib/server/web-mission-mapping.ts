// lib/server/web-mission-mapping.ts
// Correspondances pures web <-> noyau (sans dependance runtime :
// testable via node --test ; les `import type` sont effaces).
import type { EmployeeMissionStatus } from "@/core/employee/missions/employee-mission";
import type { EmployeeSpecialization } from "@/core/employee/profiles/profile-spec";

export type WebMissionStatus = "succeeded" | "failed" | "needs_review";

export function toWebStatus(
  status: EmployeeMissionStatus
): "queued" | "running" | WebMissionStatus {
  if (status === "completed") {
    return "succeeded";
  }
  if (status === "pending") {
    return "queued";
  }
  return status;
}

/**
 * Trace d'execution ajoutee au rapport : la liste brute des appels
 * d'outils prouve ce qui a vraiment tourne (anti-hallucination).
 * Volontairement en anglais (trace machine, comme le journal).
 */
export function formatToolCalls(
  calls: ReadonlyArray<{ tool: string; ok: boolean }>
): string {
  if (calls.length === 0) {
    return "Tools used: none (the employee answered without calling tools).";
  }
  const shown = calls.slice(0, 12).map((call) => {
    const name = call.tool && call.tool.trim() ? call.tool : "?";
    return `${name} (${call.ok === true ? "ok" : "failed"})`;
  });
  const extra = calls.length - shown.length;
  return `Tools used: ${shown.join(", ")}${extra > 0 ? ` (+${extra} more)` : ""}.`;
}

export function resolveSpecialization(employee: {
  talentSpec: string | null;
  specVersion: string | null;
}): EmployeeSpecialization | null {
  if (!employee.talentSpec || !employee.specVersion) {
    return null;
  }
  return { name: employee.talentSpec, version: employee.specVersion };
}

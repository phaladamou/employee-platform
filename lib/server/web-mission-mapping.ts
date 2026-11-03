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

export function resolveSpecialization(employee: {
  talentSpec: string | null;
  specVersion: string | null;
}): EmployeeSpecialization | null {
  if (!employee.talentSpec || !employee.specVersion) {
    return null;
  }
  return { name: employee.talentSpec, version: employee.specVersion };
}

import { generateEmployeeIdentity } from "./identity/employee-id";
import {
  createEmployeeProfile,
  type EmployeeProfile,
} from "./profile/employee-profile";
import {
  assignMission,
  createEmployeeMission,
} from "./missions/employee-mission";
import { EmployeeMemory } from "./memory/employee-memory";
import { EmployeeRuntime } from "./runtime/employee-runtime";
import { FetchLLMProvider } from "./runtime/fetch-llm-provider";

export type { EmployeeIdentity } from "./identity/employee-id";
export {
  generateEmployeeIdentity,
  verifyEmployeeIdentity,
} from "./identity/employee-id";

export type {
  EmployeeProfile,
  EmployeeStatus,
} from "./profile/employee-profile";
export {
  createEmployeeProfile,
  setEmployeeStatus,
} from "./profile/employee-profile";

export type {
  EmployeeMission,
  EmployeeMissionStatus,
  MissionReport,
} from "./missions/employee-mission";
export {
  assignMission,
  completeEmployeeMission,
  createEmployeeMission,
  failEmployeeMission,
  startEmployeeMission,
} from "./missions/employee-mission";

export type { MissionRecord } from "./memory/employee-memory";
export { EmployeeMemory } from "./memory/employee-memory";

export type {
  EmployeeLLMMessage,
  EmployeeLLMProvider,
  EmployeeLLMRequest,
  EmployeeLLMResponse,
} from "./runtime/llm-provider";
export type { FetchLLMConfig } from "./runtime/fetch-llm-provider";
export { FetchLLMProvider } from "./runtime/fetch-llm-provider";
export type { EmployeeRunResult } from "./runtime/employee-runtime";
export { EmployeeRuntime } from "./runtime/employee-runtime";

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
import { createCoreTools } from "./tools/tool";
import { createReadFileTool } from "./tools/read-file";
import { createWriteFileTool } from "./tools/write-file";
import { createRunShellTool } from "./tools/run-shell";

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
  migrateEmployeeProfile,
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
  flagMissionForReview,
  startEmployeeMission,
} from "./missions/employee-mission";
export {
  EMPTY_ACCEPTANCE,
  validateAcceptance,
  verifyAcceptance,
  type AcceptanceResult,
  type FileExpectation,
  type MissionAcceptance,
} from "./missions/mission-acceptance";

export type { EmployeeCredentialStore } from "./auth/credential-store";
export type {
  CredentialScope,
  EmployeeCredential,
} from "./auth/employee-credential";
export {
  CREDENTIAL_ID_PREFIX,
  CREDENTIAL_TOKEN_BYTES,
  CREDENTIAL_TOKEN_PREFIX,
  generateCredentialToken,
  hashCredentialToken,
  isCredentialScope,
  isEmployeeCredential,
  issueCredential,
  verifyCredential,
} from "./auth/employee-credential";
export type { EmployerCredentialStore } from "./auth/employer-credential-store";
export type { EmployerCredential } from "./auth/employer-credential";
export {
  EMPLOYER_CREDENTIAL_ID_PREFIX,
  EMPLOYER_TOKEN_PREFIX,
  generateEmployerToken,
  isEmployerCredential,
  issueEmployerCredential,
  verifyEmployerCredential,
} from "./auth/employer-credential";
export { FileEmployerCredentialStore } from "./auth/file-employer-credential-store";
export type { EmploymentStore } from "./employments/employment-store";
export type { Employment } from "./employments/employment";
export {
  EMPLOYMENT_ID_PREFIX,
  createEmployment,
  isEmployment,
} from "./employments/employment";
export { FileEmploymentStore } from "./employments/file-employment-store";
export { FileCredentialStore } from "./auth/file-credential-store";

export type { MissionRecord } from "./memory/employee-memory";
export { EmployeeMemory, isMissionRecord } from "./memory/employee-memory";
export type {
  EmployeeMemoryScope,
  EmployeeMemoryStore,
} from "./memory/memory-store";
export { LOCAL_EMPLOYER_ID } from "./memory/memory-store";
export {
  cancelEmployeeJob,
  claimEmployeeJob,
  createEmployeeJob,
  failEmployeeJob,
  flagJobForReview,
  heartbeatEmployeeJob,
  isJobStale,
  isTerminalJobStatus,
  requestEmployeeJobCancellation,
  requeueStaleJob,
  settleStaleCancellation,
  succeedEmployeeJob,
  type EmployeeJob,
  type JobStatus,
} from "./jobs/employee-job";
export { DEFAULT_STALE_AFTER_MS, FileJobStore } from "./jobs/file-job-store";
export {
  createPollingJobSignal,
  createStaticJobSignal,
  InMemoryJobSignal,
  isJobCancellationRequested,
  type JobRunSignal,
} from "./jobs/job-signal";
export type { JobStore } from "./jobs/job-store";
export type { MissionStore } from "./missions/mission-store";
export { FileMissionStore } from "./missions/file-mission-store";
export {
  generateMissionProof,
  generateOperatorKeyPair,
  hashReportContent,
  verifyMissionProof,
  verifyReportDisclosure,
  MISSION_PROOF_VERSION,
  type MissionProof,
  type OperatorKeyPair,
} from "./missions/mission-proof";
export type { ProfileStore } from "./profile/profile-store";
export { FileProfileStore } from "./profile/file-profile-store";
export type { EmployeeClient } from "./sdk/employee-client";
export type { EmployeeCreator } from "./sdk/employee-creator";
export {
  HttpEmployeeClient,
  HttpEmployeeError,
  type HttpEmployeeClientOptions,
} from "./sdk/http-client";
export { InProcessEmployeeClient } from "./sdk/in-process-client";
export { InProcessEmployeeCreator } from "./sdk/in-process-creator";
export {
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  runClaimedJob,
  runJobOnce,
  type JobWorkerDeps,
} from "./sdk/job-worker";
export {
  hirePath,
  jobCancelPath,
  jobEventsPath,
  jobPath,
  jobsPath,
  missionPath,
  parseServerSentEvents,
  type ApiErrorBody,
  type JobEvent,
} from "./sdk/rest-contract";
export {
  createEmployeeHandler,
  type EmployeeHttpRequest,
  type EmployeeHttpResponse,
  type EmployeeServerDeps,
} from "./server/employee-server";
export { serveEmployeeApi } from "./server/node-adapter";
export { startWorkerLoop, type WorkerLoopOptions } from "./server/worker-loop";
export {
  DEFAULT_MEMORY_DIR,
  FileMemoryStore,
} from "./memory/file-memory-store";

export type {
  EmployeeLLMMessage,
  EmployeeLLMProvider,
  EmployeeLLMRequest,
  EmployeeLLMResponse,
} from "./runtime/llm-provider";
export type { FetchLLMConfig } from "./runtime/fetch-llm-provider";
export { FetchLLMProvider } from "./runtime/fetch-llm-provider";
export type {
  EmployeeRunResult,
  EmployeeRuntimeOptions,
} from "./runtime/employee-runtime";
export { EmployeeRuntime } from "./runtime/employee-runtime";
export type {
  EmployeeProfileSpec,
  EmployeeSpecialization,
  ToolPermission,
} from "./profiles/profile-spec";
export {
  isEmployeeProfileSpec,
  isEmployeeSpecialization,
  MAX_PROFILE_STEPS,
} from "./profiles/profile-spec";
export type {
  ProfileLockfile,
  ProfileRegistry,
  ProfileRegistryTrust,
} from "./profiles/profile-registry";
export {
  createProfileLockfile,
  createProfileRegistry,
  loadProfileRegistry,
  PROFILE_LOCKFILE_NAME,
} from "./profiles/profile-registry";
export {
  canonicalizeJson,
  hashProfileContent,
} from "./profiles/profile-integrity";
export {
  TOOL_PERMISSIONS,
  resolveToolsForProfile,
} from "./runtime/profile-tools";
export type {
  ParsedAction,
  ParsedFinal,
  ParsedInvalid,
  ParsedStep,
} from "./runtime/react-protocol";
export {
  ACTION_MARKER,
  FINAL_MARKER,
  OBSERVATION_MAX_CHARS,
  formatSpecializationBlock,
  PAST_EXPERIENCE_MAX_CHARS,
  PAST_EXPERIENCE_MAX_ITEMS,
  buildSystemPrompt,
  formatObservation,
  parseStepOutput,
} from "./runtime/react-protocol";
export type {
  ReactLoopOptions,
  ReactLoopResult,
  ReactToolCall,
} from "./runtime/react-loop";
export {
  DEFAULT_MAX_STEPS,
  DEFAULT_SANDBOX_DIR,
  runReasoningLoop,
} from "./runtime/react-loop";

export type {
  EmployeeTool,
  ToolArgs,
  ToolContext,
  ToolResult,
} from "./tools/tool";
export {
  createCoreTools,
  resolveWithinRoot,
  toolFail,
  toolOk,
} from "./tools/tool";
export { READ_FILE_MAX_BYTES, createReadFileTool } from "./tools/read-file";
export { WRITE_FILE_MAX_CHARS, createWriteFileTool } from "./tools/write-file";
export {
  RUN_SHELL_DEFAULT_TIMEOUT_MS,
  RUN_SHELL_MAX_BUFFER,
  RUN_SHELL_MAX_TIMEOUT_MS,
  createRunShellTool,
} from "./tools/run-shell";

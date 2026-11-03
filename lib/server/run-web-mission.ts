// lib/server/run-web-mission.ts
// Pont serveur web -> noyau Employee (jamais importe cote client).
// Dev-first : execution in-process, la requete attend la fin de la
// mission. La production exigera un worker async (non implemente).
// Sans EMPLOYEE_SANDBOX_BIN, le shell tourne en repli Node cwd-only
// (pas de confinement Landlock) : OK en dev, pas en prod.
import "server-only";

import { resolve } from "node:path";

import {
  assignMission,
  createEmployeeMission,
} from "@/core/employee/missions/employee-mission";
import { detectMissionIntent } from "@/core/employee/missions/mission-intent";
import { EmployeeMemory } from "@/core/employee/memory/employee-memory";
import { createEmployeeProfile } from "@/core/employee/profile/employee-profile";
import { loadProfileRegistry } from "@/core/employee/profiles/profile-registry";
import { EmployeeRuntime } from "@/core/employee/runtime/employee-runtime";
import { FetchLLMProvider } from "@/core/employee/runtime/fetch-llm-provider";
import type { EmployeeLLMProvider } from "@/core/employee/runtime/llm-provider";
import { openFileStores } from "@/core/employee/stores/employee-stores";
import { EmployeeWorkspaces } from "@/core/employee/workspaces/employee-workspaces";

import {
  resolveSpecialization,
  toWebStatus,
  type WebMissionStatus,
} from "./web-mission-mapping";

function resolveProvider(): EmployeeLLMProvider {
  const providerName = (
    process.env.EMPLOYEE_PROVIDER ?? "deepseek"
  ).toLowerCase();
  if (providerName === "muse" || providerName === "meta") {
    const apiKey = process.env.MUSE_API_KEY;
    if (!apiKey) {
      throw new Error("MUSE_API_KEY is missing");
    }
    return new FetchLLMProvider({
      apiKey,
      baseUrl: process.env.MUSE_BASE_URL ?? "https://api.meta.ai/v1",
      model: process.env.MUSE_MODEL ?? "muse-spark-1.3",
    });
  }
  if (providerName === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY is missing");
    }
    return new FetchLLMProvider({
      apiKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    });
  }
  throw new Error(`Unknown EMPLOYEE_PROVIDER "${providerName}"`);
}

export interface WebMissionResult {
  status: WebMissionStatus;
  summary: string;
  needsAcceptance: boolean;
}

export async function runWebMission(input: {
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  talentSpec: string | null;
  specVersion: string | null;
  prompt: string;
}): Promise<WebMissionResult> {
  // Meme garde que partout : creation de fichier / bugfix exigent
  // des criteres declares. Le chat web n'en saisit pas : revue
  // humaine explicite au lieu d'une execution non verifiable.
  const intent = detectMissionIntent(input.prompt);
  if (intent.wantsFileCreation || intent.wantsBugfix) {
    return { status: "needs_review", summary: "", needsAcceptance: true };
  }

  const provider = resolveProvider();
  const registry = await loadProfileRegistry(
    resolve("core/employee/profiles")
  );
  const workspaces = new EmployeeWorkspaces({
    directory: resolve(process.env.EMPLOYEE_WORKSPACES_DIR ?? ".data/workspaces"),
  });
  const workspaceRoot = await workspaces.acquire(input.employeeId);
  const memory = new EmployeeMemory();
  const memoryStore = openFileStores(
    resolve(process.env.EMPLOYEE_DATA ?? ".data/employee"),
    { workspaces }
  ).memory;

  const profile = createEmployeeProfile({
    id: input.employeeId,
    name: input.employeeName,
    role: input.employeeRole,
    skills: [],
    specialization: resolveSpecialization(input),
  });
  const mission = assignMission(
    createEmployeeMission({ prompt: input.prompt }),
    profile.id
  );
  const runtime = new EmployeeRuntime(provider, {
    toolContext: {
      sandboxRoot: resolve(process.env.EMPLOYEE_SANDBOX ?? ".data/workspace"),
      workspaceRoot,
      env: { PATH: process.env.PATH },
      sandboxBin: process.env.EMPLOYEE_SANDBOX_BIN,
    },
    memory,
    memoryStore,
    profiles: registry,
  });

  const result = await runtime.run(profile, mission);
  const status = toWebStatus(result.mission.status);
  if (status !== "succeeded" && status !== "failed" && status !== "needs_review") {
    throw new Error(`Unexpected terminal status: ${result.mission.status}`);
  }
  return {
    status,
    summary: result.report?.summary ?? result.error ?? "",
    needsAcceptance: false,
  };
}

export async function chatWithEmployee(input: {
  employeeName: string;
  employeeRole: string;
  message: string;
}): Promise<string> {
  const provider = resolveProvider();
  const response = await provider.generate({
    messages: [
      {
        role: "system",
        content: `You are ${input.employeeName}, ${input.employeeRole} at Employee. Answer concisely in the user's language. You are an AI employee, never claim to be human.`,
      },
      { role: "user", content: input.message },
    ],
  });
  return response.content.trim();
}

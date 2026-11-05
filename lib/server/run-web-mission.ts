// lib/server/run-web-mission.ts
// Pont serveur web -> noyau Employee (jamais importe cote client).
// Dev-first : execution in-process, la requete attend la fin de la
// mission. La production exigera un worker async (non implemente).
// Sans EMPLOYEE_SANDBOX_BIN, le shell tourne en repli Node cwd-only
// (pas de confinement Landlock) : OK en dev, pas en prod.
import "server-only";

import { resolve } from "node:path";

import type { JobRunSignal } from "@/core/employee/jobs/job-signal";
import {
  assignMission,
  createEmployeeMission,
} from "@/core/employee/missions/employee-mission";
import {
  detectMissionIntent,
  isGithubMission,
} from "@/core/employee/missions/mission-intent";
import { EmployeeMemory } from "@/core/employee/memory/employee-memory";
import { createEmployeeProfile } from "@/core/employee/profile/employee-profile";
import { loadProfileRegistry } from "@/core/employee/profiles/profile-registry";
import { EmployeeRuntime } from "@/core/employee/runtime/employee-runtime";
import { FetchLLMProvider } from "@/core/employee/runtime/fetch-llm-provider";
import { generateReplyText } from "@/core/employee/runtime/reply-stream";
import { loadWorkspaceConventions } from "@/core/employee/runtime/workspace-conventions";
import type { EmployeeLLMProvider } from "@/core/employee/runtime/llm-provider";
import type { ReactLoopEventHandler } from "@/core/employee/runtime/react-loop";
import { openFileStores } from "@/core/employee/stores/employee-stores";
import { EmployeeWorkspaces } from "@/core/employee/workspaces/employee-workspaces";

import {
  toStoredToolCalls,
  type ToolCallRecord,
} from "./employee-conversation-mapping";
import {
  SESSION_HISTORY_MAX_CHARS,
  SESSION_HISTORY_MAX_TURNS,
  type SessionHistoryTurn,
} from "./employee-history";
import { loadUserGithubToken } from "./github-connection";
import {
  formatToolCalls,
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
  toolCalls: ToolCallRecord[];
  /** Plan annonce par l'agent ([] si aucun) : fait partie du resultat. */
  plan: string[];
}

/**
 * Reponse conversationnelle directe : UN appel LLM, zero outil,
 * zero boucle. Pour salutations, questions et avis : l'employe
 * repond au lieu de cloner/lire. L'historique recent garde le
 * fil des suivis ("et pourquoi ?").
 */
export async function runConversationalReply(input: {
  employeeName: string;
  employeeRole: string;
  talentSpec: string | null;
  history: ReadonlyArray<SessionHistoryTurn>;
  prompt: string;
  /** Workspace de session : ses conventions rejoignent le systeme. */
  workspaceRoot?: string;
  /** Texte progressif (streaming) : absent = appel bloquant. */
  onToken?: (text: string) => void | Promise<void>;
}): Promise<string> {
  const provider = resolveProvider();
  const conventions =
    input.workspaceRoot === undefined
      ? null
      : await loadWorkspaceConventions(input.workspaceRoot);
  const system = [
    `You are ${input.employeeName}, ${input.employeeRole}.`,
    ...(input.talentSpec ? [`Specialty: ${input.talentSpec}.`] : []),
    "Answer conversationally, in the user's language, briefly (a few sentences unless asked for detail).",
    "You have no tools in this mode: never invent file contents, workspace state, or GitHub data.",
    "If the question needs inspecting files, the workspace, or GitHub, say so plainly and invite the user to phrase it as a task.",
    "Past missions live under the History tab, produced files under the Files tab: point there when relevant.",
    ...(conventions !== null
      ? ["Workspace conventions (project rules, follow them):", conventions]
      : []),
  ].join("\n");
  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [{ role: "system", content: system }];
  for (const turn of input.history.slice(-SESSION_HISTORY_MAX_TURNS)) {
    const text = turn.text.trim().slice(0, SESSION_HISTORY_MAX_CHARS);
    if (text) {
      messages.push({ role: turn.role, content: text });
    }
  }
  messages.push({ role: "user", content: input.prompt });
  const text = await generateReplyText(provider, { messages }, input.onToken);
  return text.trim();
}

export async function runWebMission(input: {
  userId: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  talentSpec: string | null;
  specVersion: string | null;
  /** Session (Chat) : son sandbox isole recoit le travail. */
  sessionId: string;
  prompt: string;
  /** Tours precedant le prompt (esprit unique : la mission voit la discussion). */
  history?: ReadonlyArray<SessionHistoryTurn>;
  /** Observateur live (stream NDJSON) : thinking, etapes, resultats. */
  onEvent?: ReactLoopEventHandler;
  /** Annulation (deconnexion client) : la mission termine "cancelled". */
  signal?: JobRunSignal;
}): Promise<WebMissionResult> {
  // Meme garde que partout : creation de fichier / bugfix exigent
  // des criteres declares. Le chat web n'en saisit pas : revue
  // humaine explicite au lieu d'une execution non verifiable.
  // Exception : les missions GitHub produisent des artefacts
  // verifiables exterieurement (issues/PRs + URLs). Predicat unique
  // du noyau (mission-intent.ts), comme les chemins CLI.
  const intent = detectMissionIntent(input.prompt);
  if (
    !isGithubMission(input.prompt) &&
    (intent.wantsFileCreation || intent.wantsBugfix)
  ) {
    return {
      status: "needs_review",
      summary: "",
      needsAcceptance: true,
      toolCalls: [],
      plan: [],
    };
  }

  const provider = resolveProvider();
  const registry = await loadProfileRegistry(
    resolve("core/employee/profiles")
  );
  const workspaces = new EmployeeWorkspaces({
    directory: resolve(process.env.EMPLOYEE_WORKSPACES_DIR ?? ".data/workspaces"),
  });
  const workspaceRoot = await workspaces.acquireSession(
    input.employeeId,
    input.sessionId
  );
  const workspaceConventions =
    await loadWorkspaceConventions(workspaceRoot);
  const memory = new EmployeeMemory();
  const memoryStore = openFileStores(
    resolve(process.env.EMPLOYEE_DATA ?? ".data/employee"),
    { workspaces }
  ).memory;

  const specialization = resolveSpecialization(input);
  const spec = specialization
    ? registry.get(specialization.name, specialization.version)
    : undefined;
  // Moindre privilege : le token GitHub de l'utilisateur (consenti
  // via Settings) n'est expose aux outils que pour les profils qui
  // declarent des outils github_*. Sans connexion : les outils
  // authentifies echouent proprement, le clone public reste possible.
  const wantsGithub =
    spec?.allowedTools.some((name) => name.startsWith("github_")) ?? false;
  const githubToken = wantsGithub
    ? await loadUserGithubToken(input.userId)
    : null;

  const profile = createEmployeeProfile({
    id: input.employeeId,
    name: input.employeeName,
    role: input.employeeRole,
    skills: [],
    specialization,
  });
  const mission = assignMission(
    createEmployeeMission({ prompt: input.prompt }),
    profile.id
  );
  // Le plan annonce fait partie du resultat : capture en continu
  // (stream ou bloquant), transfere au live s'il est branche.
  let announcedPlan: string[] = [];
  const collectAndForward: ReactLoopEventHandler = async (event) => {
    if (event.type === "plan") {
      announcedPlan = [...event.steps];
    }
    await input.onEvent?.(event);
  };
  const runtime = new EmployeeRuntime(provider, {
    toolContext: {
      sandboxRoot: resolve(process.env.EMPLOYEE_SANDBOX ?? ".data/workspace"),
      workspaceRoot,
      env: {
        PATH: process.env.PATH,
        ...(wantsGithub && githubToken
          ? { GITHUB_TOKEN: githubToken }
          : {}),
      },
      sandboxBin: process.env.EMPLOYEE_SANDBOX_BIN,
    },
    memory,
    memoryStore,
    profiles: registry,
    sessionHistory: input.history?.map((turn) => ({
      role: turn.role,
      content: turn.text,
    })),
    workspaceConventions: workspaceConventions ?? undefined,
    onEvent: collectAndForward,
    signal: input.signal,
  });

  const result = await runtime.run(profile, mission);
  const status = toWebStatus(result.mission.status);
  if (status !== "succeeded" && status !== "failed" && status !== "needs_review") {
    throw new Error(`Unexpected terminal status: ${result.mission.status}`);
  }
  const base = result.report?.summary ?? result.error ?? "";
  const trace = formatToolCalls(result.toolCalls ?? []);
  return {
    status,
    summary: base ? `${base}\n\n${trace}` : trace,
    needsAcceptance: false,
    toolCalls: toStoredToolCalls(result.toolCalls ?? []),
    plan: announcedPlan,
  };
}

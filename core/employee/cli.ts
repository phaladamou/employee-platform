import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { resolve } from "node:path";

import { generateEmployeeIdentity } from "./identity/employee-id";
import { createEmployeeProfile } from "./profile/employee-profile";
import {
  assignMission,
  createEmployeeMission,
} from "./missions/employee-mission";
import { EmployeeMemory } from "./memory/employee-memory";
import {
  DEFAULT_MEMORY_DIR,
  FileMemoryStore,
} from "./memory/file-memory-store";
import { EmployeeRuntime } from "./runtime/employee-runtime";
import { DEFAULT_SANDBOX_DIR } from "./runtime/react-loop";
import { FetchLLMProvider } from "./runtime/fetch-llm-provider";

/**
 * Demonstration standalone du noyau Employee (sans l'application).
 * A executer depuis la racine du depot :
 *
 *   npx tsx core/employee/cli.ts "Relis briefing.txt et resume-le"
 *   npx tsx core/employee/cli.ts "Mission suivante" --id emp_<uuid>
 *
 * - Les outils travaillent dans .data/workspace (sandbox).
 * - La memoire est sauvegardee dans .data/memory/employee_<id>.json.
 * - Sans --id, une identite neuve est generee (historique vide).
 *   Reutilisez le meme --id pour que l'employe retrouve son passe.
 *
 * Requiert DEEPSEEK_API_KEY dans .env.local (optionnels :
 * DEEPSEEK_BASE_URL, DEEPSEEK_MODEL).
 */
async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const idFlag = rawArgs.indexOf("--id");
  let employeeId: string | null = null;

  if (idFlag !== -1) {
    employeeId = rawArgs[idFlag + 1] ?? null;
    rawArgs.splice(idFlag, 2);
  }

  const prompt = rawArgs.join(" ").trim();

  if (!prompt) {
    throw new Error('Usage: tsx core/employee/cli.ts "<mission prompt>"');
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is missing (.env.local)");
  }

  const identity = employeeId ?? generateEmployeeIdentity().id;
  const profile = createEmployeeProfile({
    id: identity,
    name: "Aria",
    role: "Data Analyst",
    skills: ["SQL", "forecasting"],
  });

  const mission = assignMission(
    createEmployeeMission({ prompt }),
    profile.id
  );

  const memory = new EmployeeMemory();
  const memoryStore = new FileMemoryStore({
    directory: resolve(DEFAULT_MEMORY_DIR),
  });
  // Seule variable transmise au shell : le reste de l'environnement
  // (cles API...) ne doit jamais fuir vers les commandes de l'employe.
  const shellEnv: Record<string, string> = {};

  if (process.env.PATH) {
    shellEnv.PATH = process.env.PATH;
  }
  if (process.platform === "win32" && process.env.SystemRoot) {
    shellEnv.SystemRoot = process.env.SystemRoot;
  }
  const runtime = new EmployeeRuntime(
    new FetchLLMProvider({
      apiKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    }),
    {
      toolContext: { sandboxRoot: resolve(DEFAULT_SANDBOX_DIR), env: shellEnv },
      memory,
      memoryStore,
    }
  );

  const result = await runtime.run(profile, mission);
  const history = memory.history(profile.id);

  console.log(`Employee: ${profile.name} (${profile.id})`);
  console.log(`Status: ${result.profile.status}`);
  console.log(`Mission: ${result.mission.status} (${result.steps} steps)`);
  console.log(
    `Tools: ${result.toolCalls.map((c) => `${c.tool}:${c.ok ? "ok" : "err"}`).join(", ") || "none"}`
  );
  console.log(`Memory: ${DEFAULT_MEMORY_DIR}/employee_${profile.id}.json`);
  console.log(`History: ${history.length} mission(s)`);

  if (result.report) {
    console.log(`Report: ${result.report.summary}`);
  }
  if (result.error) {
    console.log(`Error: ${result.error}`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { generateEmployeeIdentity } from "./identity/employee-id";
import { createEmployeeProfile } from "./profile/employee-profile";
import {
  assignMission,
  createEmployeeMission,
} from "./missions/employee-mission";
import { EmployeeMemory } from "./memory/employee-memory";
import { EmployeeRuntime } from "./runtime/employee-runtime";
import { FetchLLMProvider } from "./runtime/fetch-llm-provider";

/**
 * Demonstration standalone du noyau Employee (sans l'application) :
 *
 *   npx tsx core/employee/cli.ts "Resume les ventes du trimestre"
 *
 * Requiert DEEPSEEK_API_KEY dans .env.local (optionnels :
 * DEEPSEEK_BASE_URL, DEEPSEEK_MODEL).
 */
async function main(): Promise<void> {
  const prompt = process.argv.slice(2).join(" ").trim();

  if (!prompt) {
    throw new Error('Usage: tsx core/employee/cli.ts "<mission prompt>"');
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is missing (.env.local)");
  }

  const identity = generateEmployeeIdentity();
  let profile = createEmployeeProfile({
    id: identity.id,
    name: "Aria",
    role: "Data Analyst",
    skills: ["SQL", "forecasting"],
  });

  const mission = assignMission(
    createEmployeeMission({ prompt }),
    profile.id
  );

  const runtime = new EmployeeRuntime(
    new FetchLLMProvider({
      apiKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    })
  );

  const result = await runtime.run(profile, mission);
  profile = result.profile;

  const memory = new EmployeeMemory();
  memory.record(result.mission);

  console.log(`Employee: ${profile.name} (${profile.id})`);
  console.log(`Status: ${profile.status}`);
  console.log(`Mission: ${result.mission.status}`);

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

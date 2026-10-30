import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { resolve } from "node:path";

import { runCommand, type CliContext } from "./cli/commands";
import { FetchLLMProvider } from "./runtime/fetch-llm-provider";
import type { EmployeeLLMProvider } from "./runtime/llm-provider";

/**
 * CLI Employee : infrastructure de travailleurs async.
 * A executer depuis la racine du depot :
 *
 *   node --experimental-transform-types .tmp/emp/cli.ts serve --port 8000
 *   node --experimental-transform-types .tmp/emp/cli.ts keys issue --employer acme
 *   node --experimental-transform-types .tmp/emp/cli.ts hire emp_xxx
 *   node --experimental-transform-types .tmp/emp/cli.ts submit emp_xxx "Audit churn"
 *   node --experimental-transform-types .tmp/emp/cli.ts status job_xxx
 *   node --experimental-transform-types .tmp/emp/cli.ts events job_xxx
 *   node --experimental-transform-types .tmp/emp/cli.ts 'run "<prompt>"'
 *
 * Seul point d'entree lisant process.env (garde de purete) : tout le
 * reste du module recoit sa configuration injectee via CliContext.
 *
 * Env :
 * - EMPLOYEE_API_URL (defaut http://127.0.0.1:8000)
 * - EMPLOYEE_TOKEN (cle emo_ pour hire/submit/status/...)
 * - EMPLOYEE_DATA (defaut .data/employee)
 * - EMPLOYEE_PROFILES (defaut core/employee/profiles)
 * - EMPLOYEE_SANDBOX (defaut .data/workspace)
 * - EMPLOYEE_PROVIDER : "deepseek" (defaut) | "muse"
 *   - deepseek : DEEPSEEK_API_KEY (+ DEEPSEEK_BASE_URL, DEEPSEEK_MODEL)
 *   - muse : MUSE_API_KEY (+ MUSE_BASE_URL, MUSE_MODEL)
 */
function createLLMProvider(providerName: string): EmployeeLLMProvider {
  if (providerName === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY is missing (.env.local)");
    }
    return new FetchLLMProvider({
      apiKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    });
  }

  if (providerName === "muse" || providerName === "meta") {
    const apiKey = process.env.MUSE_API_KEY;
    if (!apiKey) {
      throw new Error("MUSE_API_KEY is missing (.env.local)");
    }
    return new FetchLLMProvider({
      apiKey,
      baseUrl: process.env.MUSE_BASE_URL ?? "https://api.meta.ai/v1",
      model: process.env.MUSE_MODEL ?? "muse-spark-1.3",
    });
  }

  throw new Error(
    `Unknown EMPLOYEE_PROVIDER "${providerName}" (expected "deepseek" or "muse")`
  );
}

function buildContext(): CliContext {
  // Seule variable transmise au shell : le reste de l'environnement
  // (cles API...) ne doit jamais fuir vers les commandes de l'employe.
  const shellEnv: Record<string, string> = {};
  if (process.env.PATH) {
    shellEnv.PATH = process.env.PATH;
  }
  if (process.platform === "win32" && process.env.SystemRoot) {
    shellEnv.SystemRoot = process.env.SystemRoot;
  }

  const providerName = (
    process.env.EMPLOYEE_PROVIDER ?? "deepseek"
  ).toLowerCase();

  // Le provider n'est requis que par serve/run : sa construction est
  // paresseuse via try/catch pour laisser keys/status fonctionner sans.
  let provider: EmployeeLLMProvider | undefined;
  let providerError: string | undefined;
  try {
    provider = createLLMProvider(providerName);
  } catch (error) {
    provider = undefined;
    providerError = error instanceof Error ? error.message : String(error);
  }

  return {
    dataDir: resolve(process.env.EMPLOYEE_DATA ?? ".data/employee"),
    apiUrl: (process.env.EMPLOYEE_API_URL ?? "http://127.0.0.1:8000").replace(
      /\/+$/,
      ""
    ),
    token: process.env.EMPLOYEE_TOKEN,
    profilesDir: resolve(process.env.EMPLOYEE_PROFILES ?? "core/employee/profiles"),
    sandboxDir: resolve(process.env.EMPLOYEE_SANDBOX ?? ".data/workspace"),
    sandboxBin: process.env.EMPLOYEE_SANDBOX_BIN,
    provider,
    providerError,
    shellEnv,
    output: (line: string) => console.log(line),
  };
}

async function main(): Promise<void> {
  const result = await runCommand(process.argv.slice(2), buildContext());
  process.exitCode = result.exitCode;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

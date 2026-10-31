import type { CredentialScope } from "../auth/employee-credential";
import { issueEmployerCredential } from "../auth/employer-credential";
import { isTerminalJobStatus } from "../jobs/employee-job";
import {
  loadProfileRegistry,
  type ProfileRegistry,
} from "../profiles/profile-registry";
import { EmployeeMemory } from "../memory/employee-memory";
import { openFileStores, type EmployeeStores } from "../stores/employee-stores";
import { EmployeeWorkspaces } from "../workspaces/employee-workspaces";

/**
 * Faisceau CLI standard : stores fichier + archive workspace sur
 * terminate. Les commandes one-shot n'ont besoin que de `stores` ;
 * serve/worker/run construisent en plus leur `EmployeeWorkspaces`
 * via `cliWorkspaces` pour hire et l'execution des jobs.
 */
function openCliStores(ctx: CliContext): EmployeeStores {
  return openFileStores(ctx.dataDir, { workspaces: cliWorkspaces(ctx) });
}

function cliWorkspaces(ctx: CliContext): EmployeeWorkspaces {
  return new EmployeeWorkspaces({ directory: ctx.workspacesDir });
}
import {
  assignMission,
  createEmployeeMission,
} from "../missions/employee-mission";
import { generateEmployeeIdentity } from "../identity/employee-id";
import { createEmployeeProfile } from "../profile/employee-profile";
import { EmployeeRuntime } from "../runtime/employee-runtime";
import type { EmployeeLLMProvider } from "../runtime/llm-provider";
import {
  HttpEmployeeClient,
  HttpEmployeeError,
} from "../sdk/http-client";
import type { JobWorkerDeps } from "../sdk/job-worker";
import { serveEmployeeApi } from "../server/node-adapter";
import { startWorkerLoop } from "../server/worker-loop";

export interface CliContext {
  /** Racine des donnees (profils, jobs, cles...). */
  readonly dataDir: string;
  readonly apiUrl: string;
  readonly token?: string;
  readonly profilesDir: string;
  readonly sandboxDir: string;
  /** Racine des workspaces dedies (<employeeId>/). */
  readonly workspacesDir: string;
  /** Fournisseur LLM (construit depuis l'env par cli.ts, injecte en test). */
  readonly provider?: EmployeeLLMProvider;
  /** Echec de construction du provider (affiche par serve/run). */
  readonly providerError?: string;
  /** Env restreinte transmise au shell (construite par cli.ts). */
  readonly shellEnv: Readonly<Record<string, string>>;
  /** Binaire emp-sandbox (EMPLOYEE_SANDBOX_BIN), absent = repli Node. */
  readonly sandboxBin?: string;
  /** Port par defaut de serve (PORT, lue par cli.ts). */
  readonly defaultPort?: number;
  /** PORT illisible (erreur paresseuse, comme providerError). */
  readonly portError?: string;
  readonly output: (line: string) => void;
}

export interface CliResult {
  readonly exitCode: number;
}

export const DEFAULT_EMPLOYER_SCOPES: readonly CredentialScope[] = [
  "missions:submit",
  "missions:read",
  "memory:read",
  "employments:read",
  "employments:write",
];

interface ParsedArgs {
  readonly positionals: string[];
  readonly flags: ReadonlyMap<string, string | true>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string | true>();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--") || arg === "--") {
      positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      flags.set(arg.slice(2, eq), arg.slice(eq + 1));
      continue;
    }
    const name = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags.set(name, next);
      i += 1;
    } else {
      flags.set(name, true);
    }
  }

  return { positionals, flags };
}

/**
 * Parse la variable PORT (convention Cloud Run / PaaS). Vide/absent =
 * pas de port impose ; invalide = erreur fatale (mieux qu'un port
 * silencieux). Pure (testee) : la lecture d'env reste dans cli.ts.
 */
export function parsePortEnv(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`PORT must be an integer, got ${JSON.stringify(value)}`);
  }
  return parsed;
}

/**
 * Port effectif de `serve` : --port > PORT (ctx) > 8000.
 * Retourne null quand le flag est invalide (erreur CLI gerable).
 */
export function resolveServePort(
  portRaw: string | true | undefined,
  defaultPort: number | undefined
): number | null {
  if (portRaw === undefined) {
    return defaultPort ?? 8000;
  }
  const parsed = Number(portRaw);
  return Number.isInteger(parsed) ? parsed : null;
}

function flag(
  flags: ReadonlyMap<string, string | true>,
  name: string
): string | undefined {
  const value = flags.get(name);
  return typeof value === "string" ? value : undefined;
}

/**
 * Parse --spec name@version (commun a publish et run). Retourne null
 * quand le format est inutilisable ; l'appelant affiche l'exemple
 * generique. Aucun metier en dur ici : la validite se verifie contre
 * le registre, jamais contre une liste codee.
 */
function parseSpecFlag(
  specRaw: string
): { name: string; version: string } | null {
  const at = specRaw.lastIndexOf("@");
  if (at <= 0) {
    return null;
  }
  return { name: specRaw.slice(0, at), version: specRaw.slice(at + 1) };
}

function clientFor(ctx: CliContext): HttpEmployeeClient {
  if (!ctx.token) {
    throw new HttpEmployeeError(
      401,
      "missing_token",
      "Missing API token (EMPLOYEE_TOKEN)"
    );
  }
  return new HttpEmployeeClient({ baseUrl: ctx.apiUrl, token: ctx.token });
}

function printError(ctx: CliContext, error: unknown): CliResult {
  if (error instanceof HttpEmployeeError) {
    ctx.output(`Error: ${error.message}`);
    return { exitCode: 1 };
  }
  ctx.output(`Error: ${error instanceof Error ? error.message : String(error)}`);
  return { exitCode: 1 };
}

async function cmdKeys(
  args: ParsedArgs,
  ctx: CliContext
): Promise<CliResult> {
  const [action, ...rest] = args.positionals;
  const stores = openCliStores(ctx);

  if (action === "issue") {
    const employerId = flag(args.flags, "employer");
    if (!employerId) {
      ctx.output("Usage: keys issue --employer <id> [--label L] [--scopes a,b] [--admin] [--ttl-ms N]");
      return { exitCode: 1 };
    }
    const label = flag(args.flags, "label") ?? `${employerId}-key`;
    const admin = args.flags.get("admin") === true;
    const scopesRaw = flag(args.flags, "scopes");
    let scopes: CredentialScope[] = scopesRaw
      ? (scopesRaw.split(",").map((scope) => scope.trim()) as CredentialScope[])
      : [...DEFAULT_EMPLOYER_SCOPES];
    if (admin && !scopes.includes("admin")) {
      scopes = [...scopes, "admin"];
    }
    const ttlRaw = flag(args.flags, "ttl-ms");
    const ttlMs = ttlRaw !== undefined ? Number(ttlRaw) : undefined;

    try {
      const { credential, token } = issueEmployerCredential({
        employerId,
        label,
        scopes,
        ttlMs,
      });
      await stores.credentials.save(credential);
      ctx.output(`id: ${credential.id}`);
      ctx.output(`token: ${token}`);
      ctx.output(`scopes: ${credential.scopes.join(",")}`);
      return { exitCode: 0 };
    } catch (error) {
      return printError(ctx, error);
    }
  }

  if (action === "revoke") {
    const [id] = rest;
    if (!id) {
      ctx.output("Usage: keys revoke <credentialId>");
      return { exitCode: 1 };
    }
    try {
      await stores.credentials.revoke(id);
      ctx.output(`revoked: ${id}`);
      return { exitCode: 0 };
    } catch (error) {
      return printError(ctx, error);
    }
  }

  if (action === "list") {
    const employerId = flag(args.flags, "employer");
    if (!employerId) {
      ctx.output("Usage: keys list --employer <id>");
      return { exitCode: 1 };
    }
    const list = await stores.credentials.listByEmployer(employerId);
    if (list.length === 0) {
      ctx.output("(no keys)");
      return { exitCode: 0 };
    }
    for (const credential of list) {
      const state = credential.revokedAt
        ? "revoked"
        : credential.expiresAt && credential.expiresAt <= new Date().toISOString()
          ? "expired"
          : "active";
      ctx.output(
        `${credential.id} ${credential.label} [${credential.scopes.join(",")}] ${state}`
      );
    }
    return { exitCode: 0 };
  }

  ctx.output("Usage: keys <issue|revoke|list> ...");
  return { exitCode: 1 };
}

async function cmdPublish(
  args: ParsedArgs,
  ctx: CliContext
): Promise<CliResult> {
  const name = flag(args.flags, "name");
  const role = flag(args.flags, "role");
  if (!name || !role) {
    ctx.output(
      "Usage: publish --name <name> --role <role> [--skills a,b] [--spec name@version] [--created-by C]"
    );
    return { exitCode: 1 };
  }

  const skillsRaw = flag(args.flags, "skills");
  const specRaw = flag(args.flags, "spec");
  let specialization: { name: string; version: string } | null = null;
  if (specRaw) {
    const parsed = parseSpecFlag(specRaw);
    if (!parsed) {
      ctx.output("Error: --spec must look like name@1.0.0");
      return { exitCode: 1 };
    }
    specialization = parsed;
  }

  try {
    if (!ctx.token) {
      throw new HttpEmployeeError(
        401,
        "missing_token",
        "Missing API token (EMPLOYEE_TOKEN)"
      );
    }
    const response = await fetch(`${ctx.apiUrl}/v1/employees`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ctx.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name,
        role,
        skills: skillsRaw
          ? skillsRaw.split(",").map((skill) => skill.trim())
          : undefined,
        specialization,
        createdBy: flag(args.flags, "created-by"),
      }),
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const message =
        typeof payload === "object" && payload !== null
          ? String((payload as Record<string, unknown>).message ?? response.status)
          : String(response.status);
      ctx.output(`Error: ${message}`);
      return { exitCode: 1 };
    }
    const id = (payload as { id: string }).id;
    ctx.output(`employee: ${id}`);
    return { exitCode: 0 };
  } catch (error) {
    return printError(ctx, error);
  }
}

async function cmdHire(args: ParsedArgs, ctx: CliContext): Promise<CliResult> {
  const [employeeId] = args.positionals;
  if (!employeeId) {
    ctx.output("Usage: hire <employeeId>");
    return { exitCode: 1 };
  }
  try {
    const employment = await clientFor(ctx).hire(employeeId);
    ctx.output(`hired: ${employment.id} (employee ${employment.employeeId})`);
    return { exitCode: 0 };
  } catch (error) {
    return printError(ctx, error);
  }
}

async function cmdSubmit(args: ParsedArgs, ctx: CliContext): Promise<CliResult> {
  const [employeeId, ...promptParts] = args.positionals;
  const prompt = promptParts.join(" ").trim();
  if (!employeeId || !prompt) {
    ctx.output(
      'Usage: submit <employeeId> "<prompt>" [--expect-file a,b] [--expect-contains a=text]'
    );
    return { exitCode: 1 };
  }

  // Criteres d'acceptation : fichiers exiges (+ sous-chaines requises).
  const files: { path: string; contains?: string | null }[] = [];
  const expectRaw = flag(args.flags, "expect-file");
  if (expectRaw !== undefined) {
    for (const part of expectRaw.split(",")) {
      const path = part.trim();
      if (!path) {
        ctx.output("Error: --expect-file paths cannot be empty");
        return { exitCode: 1 };
      }
      files.push({ path, contains: null });
    }
  }
  const containsRaw = flag(args.flags, "expect-contains");
  if (containsRaw !== undefined) {
    for (const part of containsRaw.split(",")) {
      const eq = part.indexOf("=");
      const path = (eq === -1 ? part : part.slice(0, eq)).trim();
      const text = eq === -1 ? "" : part.slice(eq + 1);
      if (!path || !text) {
        ctx.output('Error: --expect-contains must look like "a.txt=text"');
        return { exitCode: 1 };
      }
      const existing = files.find((entry) => entry.path === path);
      if (existing) {
        existing.contains = text;
      } else {
        files.push({ path, contains: text });
      }
    }
  }

  try {
    const job = await clientFor(ctx).submit(
      employeeId,
      prompt,
      files.length > 0 ? { acceptance: { files } } : {}
    );
    ctx.output(`job: ${job.id} (${job.status})`);
    return { exitCode: 0 };
  } catch (error) {
    return printError(ctx, error);
  }
}

function printJob(
  ctx: CliContext,
  job: {
    id: string;
    status: string;
    report: string | null;
    error: string | null;
  }
): void {
  ctx.output(`job: ${job.id} (${job.status})`);
  // needs_review porte les deux (rapport preserve + motif) : affiche
  // tout ce qui est present, quel que soit le statut.
  if (job.report) {
    ctx.output(`report: ${job.report}`);
  }
  if (job.error) {
    ctx.output(`error: ${job.error}`);
  }
}

async function cmdStatus(args: ParsedArgs, ctx: CliContext): Promise<CliResult> {
  const [jobId] = args.positionals;
  if (!jobId) {
    ctx.output("Usage: status <jobId>");
    return { exitCode: 1 };
  }
  try {
    const job = await clientFor(ctx).status(jobId);
    if (!job) {
      ctx.output("Error: Job not found");
      return { exitCode: 1 };
    }
    printJob(ctx, job);
    return { exitCode: 0 };
  } catch (error) {
    return printError(ctx, error);
  }
}

async function cmdCancel(args: ParsedArgs, ctx: CliContext): Promise<CliResult> {
  const [jobId] = args.positionals;
  if (!jobId) {
    ctx.output("Usage: cancel <jobId>");
    return { exitCode: 1 };
  }
  try {
    const job = await clientFor(ctx).cancel(jobId);
    if (!job) {
      ctx.output("Error: Job not found");
      return { exitCode: 1 };
    }
    printJob(ctx, job);
    return { exitCode: 0 };
  } catch (error) {
    return printError(ctx, error);
  }
}

async function cmdEvents(args: ParsedArgs, ctx: CliContext): Promise<CliResult> {
  const [jobId] = args.positionals;
  if (!jobId) {
    ctx.output("Usage: events <jobId>");
    return { exitCode: 1 };
  }
  try {
    for await (const event of clientFor(ctx).events(jobId)) {
      printJob(ctx, event.job);
      if (isTerminalJobStatus(event.job.status)) {
        return { exitCode: 0 };
      }
    }
    return { exitCode: 0 };
  } catch (error) {
    return printError(ctx, error);
  }
}

async function cmdRun(args: ParsedArgs, ctx: CliContext): Promise<CliResult> {
  const idOverride = flag(args.flags, "id") ?? null;
  const specRaw = flag(args.flags, "spec");
  const prompt = args.positionals.join(" ").trim();
  if (!prompt) {
    ctx.output(
      'Usage: run "<prompt>" [--id <employeeId>] [--spec name@version]'
    );
    return { exitCode: 1 };
  }
  let specialization: { name: string; version: string } | null = null;
  if (specRaw) {
    const parsed = parseSpecFlag(specRaw);
    if (!parsed) {
      ctx.output("Error: --spec must look like name@1.0.0");
      return { exitCode: 1 };
    }
    specialization = parsed;
  }
  if (!ctx.provider) {
    ctx.output(
      `Error: ${ctx.providerError ?? "no LLM provider configured (EMPLOYEE_PROVIDER)"}`
    );
    return { exitCode: 1 };
  }

  // Registre charge uniquement sur demande : le run par defaut reste
  // generaliste, le metier ne vient que de --spec (fail fast).
  let registry: ProfileRegistry | undefined;
  if (specialization) {
    try {
      registry = await loadProfileRegistry(ctx.profilesDir);
    } catch (error) {
      return printError(ctx, error);
    }
    if (!registry.get(specialization.name, specialization.version)) {
      ctx.output(
        `Error: Unknown profile "${specialization.name}@${specialization.version}"`
      );
      return { exitCode: 1 };
    }
  }

  const identity = idOverride ? undefined : generateEmployeeIdentity();
  const profile = createEmployeeProfile({
    id: identity?.id ?? idOverride ?? "",
    name: "Runner",
    role: "Generalist",
    skills: [],
    specialization,
    identity,
  });
  const mission = assignMission(
    createEmployeeMission({ prompt }),
    profile.id
  );
  const memory = new EmployeeMemory();
  const workspaces = cliWorkspaces(ctx);
  const memoryStore = openFileStores(ctx.dataDir, { workspaces }).memory;

  try {
    const workspaceRoot = await workspaces.acquire(profile.id);
    const runtime = new EmployeeRuntime(ctx.provider, {
      toolContext: { sandboxRoot: ctx.sandboxDir, env: { ...ctx.shellEnv }, sandboxBin: ctx.sandboxBin, workspaceRoot },
      memory,
      memoryStore,
      profiles: registry,
    });
    const result = await runtime.run(profile, mission);
    ctx.output(`Employee: ${profile.name} (${profile.id})`);
    ctx.output(`Mission: ${result.mission.status} (${result.steps} steps)`);
    if (result.report) {
      ctx.output(`Report: ${result.report.summary}`);
    }
    if (result.error) {
      ctx.output(`Error: ${result.error}`);
      return { exitCode: 1 };
    }
    return { exitCode: 0 };
  } catch (error) {
    return printError(ctx, error);
  }
}

export interface ServeHandle {
  readonly url: string;
  stop(): Promise<void>;
}

export interface ServeOptions {
  readonly port?: number;
  readonly host?: string;
  readonly withWorker?: boolean;
  readonly workerIntervalMs?: number;
}

/**
 * Demarre l'API REST (+ boucle worker sauf withWorker: false).
 * Utilise par `serve` et par le test E2E (meme chemin, sans spawn).
 */
export async function startServe(
  ctx: CliContext,
  options: ServeOptions = {}
): Promise<ServeHandle> {
  const workspaces = cliWorkspaces(ctx);
  const stores = openFileStores(ctx.dataDir, { workspaces });
  const registry = await loadProfileRegistry(ctx.profilesDir);
  const server = await serveEmployeeApi(
    {
      profiles: stores.profiles,
      employments: stores.employments,
      missions: stores.missions,
      jobs: stores.jobs,
      credentials: stores.credentials,
      registry,
      workspaces,
    },
    { port: options.port, host: options.host }
  );

  let stopWorker: (() => Promise<void>) | null = null;
  if (options.withWorker !== false) {
    try {
      const worker = await startWorker(ctx, {
        workerIntervalMs: options.workerIntervalMs,
      });
      stopWorker = worker.stop;
    } catch (error) {
      await server.close();
      throw error;
    }
  }

  return {
    url: server.url,
    stop: async () => {
      if (stopWorker) {
        await stopWorker();
      }
      await server.close();
    },
  };
}

export interface StartWorkerOptions {
  readonly workerId?: string;
  readonly workerIntervalMs?: number;
  readonly staleAfterMs?: number | null;
}

/**
 * Demarre un worker seul (sans API) sur le data dir. Utilise par
 * `worker` et les tests ; N workers peuvent tourner en parallele
 * (claims atomiques).
 */
export async function startWorker(
  ctx: CliContext,
  options: StartWorkerOptions = {}
): Promise<{ stop(): Promise<void> }> {
  if (!ctx.provider) {
    throw new Error(
      ctx.providerError ?? "no LLM provider configured (EMPLOYEE_PROVIDER)"
    );
  }
  const workspaces = cliWorkspaces(ctx);
  const stores = openFileStores(ctx.dataDir, { workspaces });
  const registry = await loadProfileRegistry(ctx.profilesDir);
  const provider: EmployeeLLMProvider = ctx.provider;
  const workerDeps: JobWorkerDeps = {
    jobs: stores.jobs,
    missions: stores.missions,
    profiles: stores.profiles,
    provider,
    toolContext: { sandboxRoot: ctx.sandboxDir, env: { ...ctx.shellEnv }, sandboxBin: ctx.sandboxBin },
    workspaces,
    profilesRegistry: registry,
    memory: new EmployeeMemory(),
    memoryStore: stores.memory,
  };
  return startWorkerLoop(workerDeps, {
    workerId: options.workerId ?? `worker_${process.pid}`,
    intervalMs: options.workerIntervalMs,
    staleAfterMs: options.staleAfterMs,
  });
}

async function cmdRecover(
  args: ParsedArgs,
  ctx: CliContext
): Promise<CliResult> {
  const staleRaw = flag(args.flags, "stale-after-ms");
  const staleAfterMs = staleRaw !== undefined ? Number(staleRaw) : undefined;
  if (
    staleAfterMs !== undefined &&
    (!Number.isFinite(staleAfterMs) || staleAfterMs < 0)
  ) {
    ctx.output("Error: --stale-after-ms must be a positive number");
    return { exitCode: 1 };
  }

  try {
    const stores = openCliStores(ctx);
    const recovered = await stores.jobs.recoverStaleJobs(
      staleAfterMs === undefined ? {} : { staleAfterMs }
    );
    if (recovered.length === 0) {
      ctx.output("(no stale jobs)");
      return { exitCode: 0 };
    }
    for (const job of recovered) {
      ctx.output(`recovered: ${job.id} -> ${job.status}`);
    }
    return { exitCode: 0 };
  } catch (error) {
    return printError(ctx, error);
  }
}

async function cmdServe(args: ParsedArgs, ctx: CliContext): Promise<CliResult> {
  const portRaw = flag(args.flags, "port");
  const host = flag(args.flags, "host");
  if (portRaw === undefined && ctx.portError !== undefined) {
    ctx.output(`Error: ${ctx.portError}`);
    return { exitCode: 1 };
  }
  const port = resolveServePort(portRaw, ctx.defaultPort);
  if (port === null) {
    ctx.output("Error: --port must be an integer");
    return { exitCode: 1 };
  }

  try {
    const handle = await startServe(ctx, { port, host });
    ctx.output(`listening: ${handle.url}`);

    await new Promise<void>((resolve) => {
      const shutdown = () => resolve();
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
    });
    await handle.stop();
    return { exitCode: 0 };
  } catch (error) {
    return printError(ctx, error);
  }
}

async function cmdWorker(args: ParsedArgs, ctx: CliContext): Promise<CliResult> {
  const workerId = flag(args.flags, "id") ?? undefined;
  const intervalRaw = flag(args.flags, "interval-ms");
  const intervalMs = intervalRaw !== undefined ? Number(intervalRaw) : undefined;
  if (intervalRaw !== undefined && !Number.isInteger(intervalMs)) {
    ctx.output("Error: --interval-ms must be an integer");
    return { exitCode: 1 };
  }

  try {
    const worker = await startWorker(ctx, { workerId, workerIntervalMs: intervalMs });
    ctx.output(`worker started on ${ctx.dataDir} (Ctrl-C to stop)`);

    await new Promise<void>((resolve) => {
      const shutdown = () => resolve();
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
    });
    await worker.stop();
    return { exitCode: 0 };
  } catch (error) {
    return printError(ctx, error);
  }
}

function usage(ctx: CliContext): CliResult {
  ctx.output(
    [
      "Usage: cli.ts <command> [args]",
      "",
      "  serve [--port N] [--host H]   start API + worker (port: --port, $PORT, 8000)",
      "  worker [--id W] [--interval-ms N]   start a worker alone",
      "  recover [--stale-after-ms N]   requeue orphaned jobs",
      "  publish --name N --role R [--skills a,b] [--spec n@v] [--created-by C]   (admin)",
      "  hire <employeeId>",
      "  submit <employeeId> \"<prompt>\" [--expect-file a,b] [--expect-contains a=text]",
      "  status <jobId>",
      "  cancel <jobId>",
      "  events <jobId>",
      "  keys issue --employer <id> [--label L] [--scopes a,b] [--admin] [--ttl-ms N]",
      "  keys revoke <credentialId>",
      "  keys list --employer <id>",
      '  run "<prompt>" [--id <employeeId>] [--spec name@version]   local demo (no server)',
      "",
      "Env: EMPLOYEE_API_URL, EMPLOYEE_TOKEN, EMPLOYEE_DATA, EMPLOYEE_PROFILES,",
      "     EMPLOYEE_SANDBOX, EMPLOYEE_SANDBOX_BIN, EMPLOYEE_PROVIDER (+ provider keys).",
    ].join("\n")
  );
  return { exitCode: 1 };
}

/**
 * Dispatche argv (sans node ni script) vers la commande. Retrouve le
 * comportement historique (prompt nu => run) pour compatibilite.
 */
export async function runCommand(
  argv: string[],
  ctx: CliContext
): Promise<CliResult> {
  const [command, ...rest] = argv;

  if (command === undefined || command === "help" || command === "--help") {
    return usage(ctx);
  }

  const args = parseArgs(rest);

  switch (command) {
    case "serve":
      return cmdServe(args, ctx);
    case "worker":
      return cmdWorker(args, ctx);
    case "recover":
      return cmdRecover(args, ctx);
    case "publish":
      return cmdPublish(args, ctx);
    case "hire":
      return cmdHire(args, ctx);
    case "submit":
      return cmdSubmit(args, ctx);
    case "status":
      return cmdStatus(args, ctx);
    case "cancel":
      return cmdCancel(args, ctx);
    case "events":
      return cmdEvents(args, ctx);
    case "keys":
      return cmdKeys(args, ctx);
    case "run":
      return cmdRun(args, ctx);
    default:
      // Compat historique : prompt nu => run (les flags --id suivent).
      if (command.startsWith("--")) {
        return usage(ctx);
      }
      return cmdRun(parseArgs(argv), ctx);
  }
}

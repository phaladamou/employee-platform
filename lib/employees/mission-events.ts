// lib/employees/mission-events.ts
// Protocole live des missions employe (sans dependance noyau ni
// Next/React : importable cote client). Le serveur y envoie les
// evenements de la boucle ReAct en NDJSON (une ligne = un JSON),
// l'UI reduit le flux en timeline d'etapes.
// Comportement verrouille par mission-events.test.ts :
// `node --test lib/employees/mission-events.test.ts`.

// Miroir de ReactLoopEvent (core/employee/runtime/react-loop.ts) :
// `thinking` avant chaque appel LLM, `plan` (etapes annoncees par
// l'agent au premier tour), `step` (titre agent + outil + temps de
// reflexion), `tool_result` qui clot l'etape (fichiers modifies),
// `final` sur le rapport, `error` terminal. Les numeros d'etape
// sont en base 1, dans l'ordre.
export interface MissionDiffRow {
  type: "same" | "add" | "del";
  oldNo: number | null;
  newNo: number | null;
  text: string;
}

export interface MissionFileChange {
  path: string;
  status: "added" | "modified";
  added: number;
  removed: number;
  rows: MissionDiffRow[];
  truncated: boolean;
}

export type MissionStreamEvent =
  | { type: "thinking"; step: number }
  | { type: "plan"; step: number; steps: string[] }
  | {
      type: "step";
      step: number;
      title: string | null;
      tool: string | null;
      thoughtMs: number;
    }
  | {
      type: "tool_result";
      step: number;
      tool: string;
      ok: boolean;
      files: MissionFileChange[];
    }
  | { type: "final"; step: number; title: string | null; thoughtMs: number }
  | { type: "error"; step: number; message: string };

export interface MissionDoneMission {
  id: string;
  title: string;
  status: string;
  employeeId: string;
}

export interface MissionDoneMessage {
  type: "done";
  mission: MissionDoneMission;
  summary: string;
  needsAcceptance: boolean;
  sessionId: string;
}

export type MissionStreamMessage = MissionStreamEvent | MissionDoneMessage;

// Charge utile de la reponse JSON bloquante historique (POST
// mission sans ?stream=1) : acceptee en repli quand le flux ne
// contient pas de `done` (serveur pas a jour, proxy qui
// rebufferise). Validation stricte, jamais d'exception.
export interface LegacyMissionResult {
  mission: MissionDoneMission;
  summary: string;
  needsAcceptance: boolean;
  sessionId: string | null;
}

export function parseLegacyMissionResult(
  text: string
): LegacyMissionResult | null {
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(data)) {
    return null;
  }
  const mission = data.mission;
  if (
    !isRecord(mission) ||
    typeof mission.id !== "string" ||
    typeof mission.title !== "string" ||
    typeof mission.status !== "string" ||
    typeof mission.employeeId !== "string" ||
    typeof data.summary !== "string" ||
    typeof data.needsAcceptance !== "boolean"
  ) {
    return null;
  }
  return {
    mission: {
      id: mission.id,
      title: mission.title,
      status: mission.status,
      employeeId: mission.employeeId,
    },
    summary: data.summary,
    needsAcceptance: data.needsAcceptance,
    sessionId: typeof data.sessionId === "string" ? data.sessionId : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStep(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
    ? value
    : null;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function asThoughtMs(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function asDiffRow(value: unknown): MissionDiffRow | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (row.type !== "same" && row.type !== "add" && row.type !== "del") {
    return null;
  }
  const lineNo = (input: unknown): number | null | undefined => {
    if (input === null) return null;
    return typeof input === "number" &&
      Number.isInteger(input) &&
      (input as number) >= 0
      ? (input as number)
      : undefined;
  };
  const oldNo = lineNo(row.oldNo);
  const newNo = lineNo(row.newNo);
  if (oldNo === undefined || newNo === undefined) {
    return null;
  }
  if (typeof row.text !== "string") {
    return null;
  }
  return { type: row.type, oldNo, newNo, text: row.text };
}

function asFileChange(value: unknown): MissionFileChange | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const entry = value as Record<string, unknown>;
  if (typeof entry.path !== "string" || !entry.path) {
    return null;
  }
  if (entry.status !== "added" && entry.status !== "modified") {
    return null;
  }
  if (
    typeof entry.added !== "number" ||
    !Number.isInteger(entry.added) ||
    entry.added < 0 ||
    typeof entry.removed !== "number" ||
    !Number.isInteger(entry.removed) ||
    entry.removed < 0 ||
    !Array.isArray(entry.rows) ||
    typeof entry.truncated !== "boolean"
  ) {
    return null;
  }
  const rows: MissionDiffRow[] = [];
  for (const row of entry.rows) {
    const parsed = asDiffRow(row);
    if (!parsed) {
      return null;
    }
    rows.push(parsed);
  }
  return {
    path: entry.path,
    status: entry.status,
    added: entry.added,
    removed: entry.removed,
    rows,
    truncated: entry.truncated,
  };
}

// Etapes annoncees : tableau non vide de chaines non vides, borne
// defensive (le noyau plafonne deja a 12).
function asPlanSteps(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 24) {
    return null;
  }
  const steps: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !entry.trim()) {
      return null;
    }
    steps.push(entry);
  }
  return steps;
}

function asFileChanges(value: unknown): MissionFileChange[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const files: MissionFileChange[] = [];
  for (const entry of value) {
    const parsed = asFileChange(entry);
    if (!parsed) {
      return null;
    }
    files.push(parsed);
  }
  return files;
}

// Valide une ligne NDJSON : JSON malforme ou forme inconnue ->
// null (ignoree, le flux continue), jamais d'exception.
export function parseMissionMessage(line: string): MissionStreamMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(line) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(data) || typeof data.type !== "string") {
    return null;
  }
  if (data.type === "done") {
    const mission = data.mission;
    if (
      !isRecord(mission) ||
      typeof mission.id !== "string" ||
      typeof mission.title !== "string" ||
      typeof mission.status !== "string" ||
      typeof mission.employeeId !== "string" ||
      typeof data.summary !== "string" ||
      typeof data.needsAcceptance !== "boolean" ||
      typeof data.sessionId !== "string"
    ) {
      return null;
    }
    return {
      type: "done",
      mission: {
        id: mission.id,
        title: mission.title,
        status: mission.status,
        employeeId: mission.employeeId,
      },
      summary: data.summary,
      needsAcceptance: data.needsAcceptance,
      sessionId: data.sessionId,
    };
  }
  const step = asStep(data.step);
  if (step === null) {
    return null;
  }
  switch (data.type) {
    case "thinking":
      return { type: "thinking", step };
    case "plan": {
      const steps = asPlanSteps(data.steps);
      if (steps === null) {
        return null;
      }
      return { type: "plan", step, steps };
    }
    case "step": {
      const title = asNullableString(data.title);
      const tool = asNullableString(data.tool);
      const thoughtMs = asThoughtMs(data.thoughtMs);
      if (title === undefined || tool === undefined || thoughtMs === null) {
        return null;
      }
      return { type: "step", step, title, tool, thoughtMs };
    }
    case "tool_result": {
      const files = asFileChanges(data.files);
      if (
        typeof data.tool !== "string" ||
        typeof data.ok !== "boolean" ||
        files === null
      ) {
        return null;
      }
      return { type: "tool_result", step, tool: data.tool, ok: data.ok, files };
    }
    case "final": {
      const title = asNullableString(data.title);
      const thoughtMs = asThoughtMs(data.thoughtMs);
      if (title === undefined || thoughtMs === null) {
        return null;
      }
      return { type: "final", step, title, thoughtMs };
    }
    case "error":
      if (typeof data.message !== "string") {
        return null;
      }
      return { type: "error", step, message: data.message };
    default:
      return null;
  }
}

export interface MissionStreamParser {
  push: (chunk: string) => void;
  flush: () => void;
}

// Decoupeur incremental : les morceaux reseau coupent les lignes
// n'importe ou, seules les lignes completes sont emises.
export function createMissionStreamParser(
  onMessage: (message: MissionStreamMessage) => void
): MissionStreamParser {
  let buffer = "";
  const emit = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    const message = parseMissionMessage(trimmed);
    if (message) {
      onMessage(message);
    }
  };
  return {
    push(chunk: string) {
      buffer += chunk;
      let index = buffer.indexOf("\n");
      while (index !== -1) {
        emit(buffer.slice(0, index));
        buffer = buffer.slice(index + 1);
        index = buffer.indexOf("\n");
      }
    },
    flush() {
      emit(buffer);
      buffer = "";
    },
  };
}

export type MissionStepStatus = "running" | "ok" | "failed";

export interface MissionStepState {
  step: number;
  title: string | null;
  tool: string | null;
  status: MissionStepStatus;
  /** Duree de reflexion (ms) ayant produit l'etape. */
  thoughtMs: number | null;
}

export interface MissionProgressState {
  steps: MissionStepState[];
  /** Etape en reflexion (LLM en cours), null entre deux tours. */
  thinkingStep: number | null;
  /** Titre agent du rapport final, une fois emis. */
  finalTitle: string | null;
  /** Reflexion ayant produit le rapport final, une fois emise. */
  finalThoughtMs: number | null;
  /** Message d'erreur terminal, une fois emis. */
  failed: string | null;
  /** Fichiers modifies (onglet Changes), derniere version par chemin. */
  changes: MissionFileChange[];
  /** Etapes annoncees par l'agent (live seul, jamais persiste). */
  plan: string[];
}

export function emptyMissionProgress(): MissionProgressState {
  return {
    steps: [],
    thinkingStep: null,
    finalTitle: null,
    finalThoughtMs: null,
    failed: null,
    changes: [],
    plan: [],
  };
}

// Reconstruit une timeline terminee depuis les appels stockes
// (onglet Historique : memes lignes, sans le live).
export function progressFromRecords(
  records: ReadonlyArray<{
    tool: string;
    ok: boolean;
    title?: string;
    thoughtMs?: number;
  }>
): MissionProgressState {
  return {
    steps: records.map((record, index) => ({
      step: index + 1,
      title: record.title ?? null,
      tool: record.tool,
      status: record.ok ? "ok" : "failed",
      thoughtMs: record.thoughtMs ?? null,
    })),
    thinkingStep: null,
    finalTitle: null,
    finalThoughtMs: null,
    failed: null,
    changes: [],
    plan: [],
  };
}

// Affichage "Thought for Xs" facon Devin (secondes entieres, min 1).
export function formatThoughtSecs(thoughtMs: number): number {
  return Math.max(1, Math.round(thoughtMs / 1000));
}

export type MissionDisplayStatus =
  | "succeeded"
  | "failed"
  | "cancelled"
  | "needs_review";

// Statut affiche par la banniere d'execution, derive du resultat
// terminal. "cancelled" n'existe pas dans le noyau (failed avec la
// sentinelle exacte "cancelled" posee par la boucle) : on le
// reconnait ici, sans toucher au moteur.
export function resolveMissionDisplayStatus(outcome: {
  status: string;
  summary: string;
  needsAcceptance: boolean;
}): MissionDisplayStatus {
  if (outcome.needsAcceptance || outcome.status === "needs_review") {
    return "needs_review";
  }
  if (outcome.status === "succeeded") {
    return "succeeded";
  }
  if (outcome.summary.trim().toLowerCase() === "cancelled") {
    return "cancelled";
  }
  return "failed";
}

// Reduit un evenement en etat de timeline (pur : meme entree,
// meme sortie). Resilient aux trous (tool_result sans step prealable
// : la ligne est creee terminee).
export function applyMissionEvent(
  state: MissionProgressState,
  event: MissionStreamEvent
): MissionProgressState {
  switch (event.type) {
    case "thinking":
      return { ...state, thinkingStep: event.step };
    case "plan":
      return { ...state, plan: [...event.steps], thinkingStep: null };
    case "step": {
      const steps = state.steps.filter((row) => row.step !== event.step);
      steps.push({
        step: event.step,
        title: event.title,
        tool: event.tool,
        status: "running",
        thoughtMs: event.thoughtMs,
      });
      steps.sort((a, b) => a.step - b.step);
      return { ...state, steps, thinkingStep: null };
    }
    case "tool_result": {
      const status: MissionStepStatus = event.ok ? "ok" : "failed";
      const existing = state.steps.find((row) => row.step === event.step);
      const steps = existing
        ? state.steps.map((row) =>
            row.step === event.step
              ? { ...row, tool: event.tool, status }
              : row
          )
        : [
            ...state.steps,
            {
              step: event.step,
              title: null,
              tool: event.tool,
              status,
              thoughtMs: null,
            },
          ].sort((a, b) => a.step - b.step);
      // Dernieres modifications par chemin (un fichier reecrit
      // remplace sa version precedente, ordre stable).
      const changes = state.changes.filter(
        (change) =>
          !event.files.some((file) => file.path === change.path)
      );
      for (const file of event.files) {
        changes.push(file);
      }
      return { ...state, steps, thinkingStep: null, changes };
    }
    case "final":
      return {
        ...state,
        thinkingStep: null,
        finalTitle: event.title,
        finalThoughtMs: event.thoughtMs,
      };
    case "error":
      return { ...state, thinkingStep: null, failed: event.message };
  }
}

export type MissionToolPhase =
  | "thinking"
  | "github"
  | "shell"
  | "file"
  | "protocol";

// Phase d'affichage (icone) derivee du nom d'outil.
export function toolPhase(tool: string | null): MissionToolPhase {
  if (!tool) {
    return "thinking";
  }
  if (tool.startsWith("github_")) {
    return "github";
  }
  if (tool === "run_shell") {
    return "shell";
  }
  if (tool === "read_file" || tool === "write_file") {
    return "file";
  }
  if (tool === "protocol") {
    return "protocol";
  }
  return "thinking";
}

function prettify(tool: string): string {
  const words = tool.split("_").filter(Boolean);
  if (words.length === 0) {
    return tool;
  }
  const [first, ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

// Libelle technique court (volontairement en anglais, comme les
// puces d'outils de l'historique). Le titre agent reste le texte
// principal de la ligne ; ce libelle ne sert qu'en repli.
export function toolLabel(tool: string): string {
  switch (tool) {
    case "github_fork":
      return "Fork";
    case "github_clone":
      return "Clone";
    case "github_create_issue":
      return "Issue";
    case "github_create_pr":
      return "PR";
    case "github_push":
      return "Push";
    case "run_shell":
      return "Shell";
    case "read_file":
      return "Read";
    case "write_file":
      return "Write";
    case "protocol":
      return "Format";
    default:
      return prettify(tool);
  }
}

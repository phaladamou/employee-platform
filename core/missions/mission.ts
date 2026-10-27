export type MissionStatus =
  | "pending"
  | "planning"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface Mission {
  readonly id: string;
  readonly objective: string;

  status: MissionStatus;

  readonly tasks: string[];

  readonly createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;

  result?: unknown;
  error?: string;
}

/**
 * Crée une nouvelle mission.
 */
export function createMission(input: {
  id: string;
  objective: string;
}): Mission {
  const objective = input.objective.trim();

  if (!objective) {
    throw new Error("Mission objective cannot be empty");
  }

  return {
    id: input.id,
    objective,
    status: "pending",
    tasks: [],
    createdAt: new Date(),
  };
}

/**
 * Ajoute une task à une mission.
 */
export function addTask(
  mission: Mission,
  taskId: string
): void {
  if (!taskId.trim()) {
    throw new Error("Task ID cannot be empty");
  }

  if (mission.tasks.includes(taskId)) {
    return;
  }

  mission.tasks.push(taskId);
}

/**
 * Passe une mission en planification.
 */
export function startPlanning(
  mission: Mission
): void {
  if (mission.status !== "pending") {
    throw new Error(
      `Mission ${mission.id} cannot enter planning from status "${mission.status}"`
    );
  }

  mission.status = "planning";
}

/**
 * Passe une mission en exécution.
 */
export function startMission(
  mission: Mission
): void {
  if (
    mission.status !== "planning" &&
    mission.status !== "pending"
  ) {
    throw new Error(
      `Mission ${mission.id} cannot start from status "${mission.status}"`
    );
  }

  mission.status = "running";
  mission.startedAt ??= new Date();
}

/**
 * Termine une mission avec succès.
 */
export function completeMission(
  mission: Mission,
  result?: unknown
): void {
  if (mission.status !== "running") {
    throw new Error(
      `Mission ${mission.id} cannot complete from status "${mission.status}"`
    );
  }

  mission.status = "completed";
  mission.completedAt = new Date();
  mission.result = result;
}

/**
 * Marque une mission comme échouée.
 */
export function failMission(
  mission: Mission,
  error: string
): void {
  if (
    mission.status === "completed" ||
    mission.status === "cancelled"
  ) {
    throw new Error(
      `Mission ${mission.id} cannot fail from status "${mission.status}"`
    );
  }

  mission.status = "failed";
  mission.completedAt = new Date();
  mission.error = error;
}

/**
 * Annule une mission.
 */
export function cancelMission(
  mission: Mission,
  reason?: string
): void {
  if (
    mission.status === "completed" ||
    mission.status === "failed"
  ) {
    throw new Error(
      `Mission ${mission.id} cannot be cancelled from status "${mission.status}"`
    );
  }

  mission.status = "cancelled";
  mission.completedAt = new Date();

  if (reason) {
    mission.error = reason;
  }
}
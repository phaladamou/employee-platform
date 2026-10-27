export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface Task {
  readonly id: string;
  readonly missionId: string;
  readonly objective: string;

  status: TaskStatus;

  readonly createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;

  result?: unknown;
  error?: string;
}

/**
 * Crée une nouvelle task.
 */
export function createTask(input: {
  id: string;
  missionId: string;
  objective: string;
}): Task {
  const objective = input.objective.trim();

  if (!objective) {
    throw new Error("Task objective cannot be empty");
  }

  if (!input.missionId.trim()) {
    throw new Error("Task missionId cannot be empty");
  }

  return {
    id: input.id,
    missionId: input.missionId,
    objective,
    status: "pending",
    createdAt: new Date(),
  };
}

/**
 * Démarre une task.
 */
export function startTask(
  task: Task
): void {
  if (task.status !== "pending") {
    throw new Error(
      `Task ${task.id} cannot start from status "${task.status}"`
    );
  }

  task.status = "running";
  task.startedAt ??= new Date();
}

/**
 * Termine une task avec succès.
 */
export function completeTask(
  task: Task,
  result?: unknown
): void {
  if (task.status !== "running") {
    throw new Error(
      `Task ${task.id} cannot complete from status "${task.status}"`
    );
  }

  task.status = "completed";
  task.completedAt = new Date();
  task.result = result;
}

/**
 * Marque une task comme échouée.
 */
export function failTask(
  task: Task,
  error: string
): void {
  if (
    task.status === "completed" ||
    task.status === "cancelled"
  ) {
    throw new Error(
      `Task ${task.id} cannot fail from status "${task.status}"`
    );
  }

  task.status = "failed";
  task.completedAt = new Date();
  task.error = error;
}

/**
 * Annule une task.
 */
export function cancelTask(
  task: Task,
  reason?: string
): void {
  if (
    task.status === "completed" ||
    task.status === "failed"
  ) {
    throw new Error(
      `Task ${task.id} cannot be cancelled from status "${task.status}"`
    );
  }

  task.status = "cancelled";
  task.completedAt = new Date();

  if (reason) {
    task.error = reason;
  }
}
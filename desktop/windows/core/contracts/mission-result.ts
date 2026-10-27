import type { Mission } from "../missions/mission";
import type { Task } from "../missions/task";

export interface MissionResult {
  readonly missionId: string;
  readonly status: Mission["status"];
  readonly objective: string;
  readonly tasks: readonly Task[];
  readonly result?: unknown;
  readonly error?: string;
}

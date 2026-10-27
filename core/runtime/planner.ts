import type {
  MissionPlan,
  TaskPlan,
} from "./orchestrator";

import type { Mission } from "../missions/mission";

/**
 * Planner
 *
 * Transforme une Mission en plan d'exécution structuré.
 *
 * IMPORTANT :
 * - Le Planner ne choisit pas encore les agents.
 * - Le Planner n'exécute aucune task.
 * - Le Planner ne lance aucun outil.
 * - Le Planner produit uniquement un MissionPlan.
 *
 * Une version basée sur LLM pourra remplacer l'implémentation
 * actuelle sans modifier l'interface utilisée par l'Orchestrator.
 */
export interface Planner {
  plan(
    mission: Mission
  ): Promise<MissionPlan>;
}

/**
 * Planner déterministe minimal.
 *
 * Cette implémentation sert de première base fonctionnelle.
 * Elle crée une task à partir de l'objectif de la mission.
 *
 * Elle sera progressivement remplacée par un planner capable
 * de décomposer réellement les missions complexes.
 */
export class BasicPlanner implements Planner {
  async plan(
    mission: Mission
  ): Promise<MissionPlan> {
    const objective =
      mission.objective.trim();

    if (!objective) {
      throw new Error(
        "Cannot plan a mission without an objective"
      );
    }

    const task: TaskPlan = {
      id: `${mission.id}-task-1`,
      objective,
    };

    return {
      tasks: [task],
    };
  }
}
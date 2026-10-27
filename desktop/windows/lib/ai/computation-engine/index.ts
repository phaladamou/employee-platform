// lib/ai/computation-engine/index.ts

/**
 * Scientia Labs — Computation Engine
 * Point d'entrée principal du moteur de calcul scientifique
 */

import { ComputationEvaluator } from "./core/evaluator";
import type { ComputationRequest, ComputationResult } from "./core/types";

export class ComputationEngine {
  private evaluator: ComputationEvaluator;

  constructor() {
    this.evaluator = new ComputationEvaluator();
  }

  /**
   * Exécute un calcul mathématique
   */
  async execute(request: ComputationRequest): Promise<ComputationResult> {
    return this.evaluator.evaluate(request);
  }

  /**
   * Vérifie si un type de calcul est supporté
   */
  supports(type: string): boolean {
    const supportedTypes = [
      "evaluate",
      "derivative",
      "integral",
      "limit",
      "solve",
      "system",
      "determinant",
      "inverse",
      "eigenvalues",
      "simplify",
      "taylor",
      "convert",
      "stats",
    ];
    return supportedTypes.includes(type);
  }

  /**
   * Retourne la liste des types de calcul supportés
   */
  getSupportedTypes(): string[] {
    return [
      "evaluate - Calcul numérique simple",
      "derivative - Dérivée d'une fonction",
      "integral - Intégrale d'une fonction",
      "limit - Limite d'une fonction",
      "solve - Résolution d'équation",
      "system - Système d'équations linéaires",
      "determinant - Déterminant de matrice",
      "inverse - Inverse de matrice",
      "eigenvalues - Valeurs propres",
      "simplify - Simplification symbolique",
      "taylor - Série de Taylor",
      "convert - Conversion d'unités",
      "stats - Statistiques descriptives",
    ];
  }
}

// Export singleton
export const computationEngine = new ComputationEngine();

// Export types
export type {
  ComputationRequest,
  ComputationResult,
  ComputationStep,
  ComputationType,
} from "./core/types";

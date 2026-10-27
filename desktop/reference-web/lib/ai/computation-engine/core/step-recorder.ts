// lib/ai/computation-engine/core/step-recorder.ts

/**
 * Scientia Labs — Computation Engine
 * Enregistreur d'étapes : construit la trace pédagogique du calcul
 */

import type { ComputationStep } from "./types";

export class StepRecorder {
  private steps: ComputationStep[] = [];
  private counter = 0;

  /**
   * Enregistre une étape de calcul
   */
  add(step: {
    description: string;
    inputLatex: string;
    outputLatex: string;
    rule?: string;
  }): void {
    this.counter++;
    this.steps.push({
      step: this.counter,
      description: step.description,
      inputLatex: step.inputLatex,
      outputLatex: step.outputLatex,
      rule: step.rule,
    });
  }

  /**
   * Retourne toutes les étapes enregistrées
   */
  getAll(): ComputationStep[] {
    return this.steps;
  }

  /**
   * Retourne le nombre d'étapes
   */
  get count(): number {
    return this.counter;
  }

  /**
   * Réinitialise l'enregistreur
   */
  reset(): void {
    this.steps = [];
    this.counter = 0;
  }
}

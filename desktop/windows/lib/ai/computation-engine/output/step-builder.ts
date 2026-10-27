// lib/ai/computation-engine/output/step-builder.ts

/**
 * Scientia Labs — Computation Engine
 * Constructeur d'étapes : aide à créer des étapes formatées
 */

import type { ComputationStep } from "../core/types";
import type { FormattedStep } from "../core/types";

export class StepBuilder {
  /**
   * Crée une étape de calcul formatée
   */
  build(step: ComputationStep): FormattedStep {
    return {
      step: step.step,
      description: step.description,
      inputLatex: step.inputLatex,
      outputLatex: step.outputLatex,
      rule: step.rule,
    };
  }

  /**
   * Crée une étape simple avec texte brut
   */
  simple(stepNumber: number, description: string, input: string, output: string): FormattedStep {
    return {
      step: stepNumber,
      description,
      inputLatex: input,
      outputLatex: output,
    };
  }

  /**
   * Crée une étape avec règle mathématique
   */
  withRule(
    stepNumber: number,
    description: string,
    input: string,
    output: string,
    rule: string
  ): FormattedStep {
    return {
      step: stepNumber,
      description,
      inputLatex: input,
      outputLatex: output,
      rule,
    };
  }

  /**
   * Formate une liste d'étapes pour l'affichage
   */
  buildAll(steps: ComputationStep[]): FormattedStep[] {
    return steps.map((step) => this.build(step));
  }
}
// lib/ai/computation-engine/output/formatter.ts

/**
 * Scientia Labs — Computation Engine
 * Formateur : convertit les résultats en format LaTeX pour affichage
 */

import type { ComputationResult, FormattedOutput, FormattedStep } from "../core/types";

export class OutputFormatter {
  /**
   * Formate un résultat de calcul pour l'affichage
   */
  format(result: ComputationResult): FormattedOutput {
    return {
      inline: this.formatInline(result),
      detailed: this.formatDetailed(result),
    };
  }

  /**
   * Format compact pour la carte dans le flux du chat
   */
  private formatInline(result: ComputationResult): FormattedOutput["inline"] {
    const typeLabel = this.getTypeLabel(result.type);

    return {
      summary: `${typeLabel}: ${result.expression}`,
      latex: result.resultLatex || result.result,
    };
  }

  /**
   * Format détaillé pour le panneau latéral
   */
  private formatDetailed(result: ComputationResult): FormattedOutput["detailed"] {
    const typeLabel = this.getTypeLabel(result.type);

    return {
      title: `${typeLabel}`,
      expression: this.toLatexExpression(result.expression),
      steps: result.steps.map((step) => ({
        step: step.step,
        description: step.description,
        inputLatex: step.inputLatex,
        outputLatex: step.outputLatex,
        rule: step.rule,
      })),
      result: result.resultLatex || result.result,
    };
  }

  /**
   * Convertit une expression en format LaTeX basique
   */
  toLatexExpression(expression: string): string {
    return expression
      .replace(/\*/g, " \\cdot ")
      .replace(/\//g, " \\div ")
      .replace(/\^(\d+)/g, "^{$1}")
      .replace(/sqrt\(/g, "\\sqrt{")
      .replace(/pi/g, "\\pi")
      .replace(/infinity|inf/g, "\\infty");
  }

  /**
   * Retourne le libellé lisible d'un type de calcul
   */
  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      evaluate: "Calculation",
      derivative: "Derivative",
      integral: "Integral",
      limit: "Limit",
      solve: "Equation Solving",
      system: "Linear System",
      determinant: "Determinant",
      inverse: "Matrix Inverse",
      eigenvalues: "Eigenvalues",
      simplify: "Simplification",
      taylor: "Taylor Series",
      convert: "Unit Conversion",
      stats: "Statistics",
    };
    return labels[type] ?? "Calculation";
  }
}
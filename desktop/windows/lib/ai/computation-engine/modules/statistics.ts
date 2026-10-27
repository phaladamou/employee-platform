// lib/ai/computation-engine/modules/statistics.ts

/**
 * Scientia Labs — Computation Engine
 * Module Statistiques : moyenne, médiane, écart-type, variance, régression
 */

import { StepRecorder } from "../core/step-recorder";
import type { ParsedExpression } from "../core/parser";
import type { ComputationResult } from "../core/types";

export class StatisticsModule {
  private stepRecorder: StepRecorder;

  constructor(stepRecorder: StepRecorder) {
    this.stepRecorder = stepRecorder;
  }

  /**
   * Point d'entrée du module statistiques
   */
  async execute(parsed: ParsedExpression): Promise<ComputationResult> {
    // Déterminer l'opération depuis l'expression
    const expr = parsed.expression.toLowerCase();

    if (expr.startsWith("mean(") || expr.startsWith("average(")) {
      return this.computeMean(parsed);
    }
    if (expr.startsWith("median(")) {
      return this.computeMedian(parsed);
    }
    if (expr.startsWith("mode(")) {
      return this.computeMode(parsed);
    }
    if (expr.startsWith("var(") || expr.startsWith("variance(")) {
      return this.computeVariance(parsed);
    }
    if (expr.startsWith("std(") || expr.startsWith("stdev(")) {
      return this.computeStdDev(parsed);
    }
    if (expr.startsWith("stats(") || expr.startsWith("describe(")) {
      return this.computeAllStats(parsed);
    }

    throw new Error(
      "Unknown statistics operation. Use: mean(), median(), mode(), var(), std(), stats()"
    );
  }

  /**
   * Parse une liste de nombres depuis une chaîne
   * Format : [1, 2, 3, 4, 5] ou 1,2,3,4,5
   */
  private parseNumbers(expression: string): number[] {
    const match = expression.match(/$$([\d.,\s]+)$$/) || expression.match(/([\d.,\s]+)/);
    if (!match) {
      throw new Error("Could not parse number list. Use format: [1, 2, 3, 4, 5]");
    }

    return match[1]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(Number)
      .filter((n) => !isNaN(n));
  }

  /**
   * Calcule la moyenne arithmétique
   */
  private computeMean(parsed: ParsedExpression): ComputationResult {
    const numbers = this.parseNumbers(parsed.expression);
    const n = numbers.length;

    this.stepRecorder.add({
      description: `Parse ${n} numbers`,
      inputLatex: `[${numbers.join(", ")}]`,
      outputLatex: `n = ${n}`,
    });

    const sum = numbers.reduce((a, b) => a + b, 0);

    this.stepRecorder.add({
      description: "Compute sum of all values",
      inputLatex: `\\sum x_i = ${numbers.join(" + ")}`,
      outputLatex: `Sum = ${sum}`,
    });

    const mean = sum / n;

    this.stepRecorder.add({
      description: "Divide sum by number of values",
      inputLatex: `\\bar{x} = \\frac{${sum}}{${n}}`,
      outputLatex: `Mean = ${mean}`,
      rule: "x̄ = Σxᵢ / n",
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "stats",
      result: `Mean = ${mean}`,
      resultLatex: `\\bar{x} = ${mean}`,
      steps: this.stepRecorder.getAll(),
      metadata: {
        duration: 0,
        stepCount: this.stepRecorder.count,
        confidence: 1.0,
      },
    };
  }

  /**
   * Calcule la médiane
   */
  private computeMedian(parsed: ParsedExpression): ComputationResult {
    const numbers = this.parseNumbers(parsed.expression);
    const sorted = [...numbers].sort((a, b) => a - b);
    const n = sorted.length;

    this.stepRecorder.add({
      description: `Sort ${n} numbers in ascending order`,
      inputLatex: `[${numbers.join(", ")}]`,
      outputLatex: `[${sorted.join(", ")}]`,
    });

    let median: number;

    if (n % 2 === 0) {
      const mid1 = sorted[n / 2 - 1];
      const mid2 = sorted[n / 2];
      median = (mid1 + mid2) / 2;

      this.stepRecorder.add({
        description: "Even number of values: average the two middle values",
        inputLatex: `\\frac{${mid1} + ${mid2}}{2}`,
        outputLatex: `Median = ${median}`,
        rule: "Median = (x[n/2] + x[n/2+1]) / 2",
      });
    } else {
      median = sorted[Math.floor(n / 2)];

      this.stepRecorder.add({
        description: "Odd number of values: take the middle value",
        inputLatex: `x_{${Math.floor(n / 2) + 1}}`,
        outputLatex: `Median = ${median}`,
        rule: "Median = x[(n+1)/2]",
      });
    }

    return {
      success: true,
      expression: parsed.expression,
      type: "stats",
      result: `Median = ${median}`,
      resultLatex: `\\text{Median} = ${median}`,
      steps: this.stepRecorder.getAll(),
      metadata: {
        duration: 0,
        stepCount: this.stepRecorder.count,
        confidence: 1.0,
      },
    };
  }

  /**
   * Calcule le mode (valeur la plus fréquente)
   */
  private computeMode(parsed: ParsedExpression): ComputationResult {
    const numbers = this.parseNumbers(parsed.expression);

    const frequency: Map<number, number> = new Map();
    for (const num of numbers) {
      frequency.set(num, (frequency.get(num) || 0) + 1);
    }

    this.stepRecorder.add({
      description: "Count frequency of each value",
      inputLatex: `[${numbers.join(", ")}]`,
      outputLatex: Array.from(frequency.entries())
        .map(([val, count]) => `${val}: ${count}`)
        .join(", "),
    });

    let maxFreq = 0;
    const modes: number[] = [];

    for (const [val, count] of frequency) {
      if (count > maxFreq) {
        maxFreq = count;
        modes.length = 0;
        modes.push(val);
      } else if (count === maxFreq) {
        modes.push(val);
      }
    }

    this.stepRecorder.add({
      description: `Mode(s) with frequency ${maxFreq}`,
      inputLatex: `max frequency = ${maxFreq}`,
      outputLatex: `Mode = ${modes.join(", ")}`,
      rule: "Mode = most frequent value(s)",
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "stats",
      result: `Mode = ${modes.join(", ")}`,
      resultLatex: `\\text{Mode} = ${modes.join(", ")}`,
      steps: this.stepRecorder.getAll(),
      metadata: {
        duration: 0,
        stepCount: this.stepRecorder.count,
        confidence: 1.0,
      },
    };
  }

  /**
   * Calcule la variance (population)
   */
  private computeVariance(parsed: ParsedExpression): ComputationResult {
    const numbers = this.parseNumbers(parsed.expression);
    const n = numbers.length;
    const mean = numbers.reduce((a, b) => a + b, 0) / n;

    this.stepRecorder.add({
      description: `Compute mean: x̄ = ${mean}`,
      inputLatex: `\\bar{x} = \\frac{\\sum x_i}{${n}}`,
      outputLatex: `x̄ = ${mean}`,
    });

    const squaredDiffs = numbers.map((x) => {
      const diff = x - mean;
      return diff * diff;
    });

    this.stepRecorder.add({
      description: "Compute squared deviations from mean",
      inputLatex: `(x_i - \\bar{x})^2`,
      outputLatex: `[${squaredDiffs.join(", ")}]`,
    });

    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;

    this.stepRecorder.add({
      description: "Average the squared deviations",
      inputLatex: `\\frac{\\sum (x_i - \\bar{x})^2}{${n}}`,
      outputLatex: `σ² = ${variance}`,
      rule: "Population variance: σ² = Σ(xᵢ - x̄)² / n",
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "stats",
      result: `Variance = ${variance}`,
      resultLatex: `\\sigma^2 = ${variance}`,
      steps: this.stepRecorder.getAll(),
      metadata: {
        duration: 0,
        stepCount: this.stepRecorder.count,
        confidence: 1.0,
      },
    };
  }

  /**
   * Calcule l'écart-type
   */
  private computeStdDev(parsed: ParsedExpression): ComputationResult {
    const numbers = this.parseNumbers(parsed.expression);
    const n = numbers.length;
    const mean = numbers.reduce((a, b) => a + b, 0) / n;

    const variance =
      numbers.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);

    this.stepRecorder.add({
      description: "Compute variance first",
      inputLatex: `\\sigma^2 = \\frac{\\sum (x_i - \\bar{x})^2}{${n}}`,
      outputLatex: `σ² = ${variance}`,
    });

    this.stepRecorder.add({
      description: "Take square root of variance",
      inputLatex: `\\sigma = \\sqrt{${variance}}`,
      outputLatex: `σ = ${stdDev}`,
      rule: "σ = √(σ²)",
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "stats",
      result: `Standard Deviation = ${stdDev}`,
      resultLatex: `\\sigma = ${stdDev}`,
      steps: this.stepRecorder.getAll(),
      metadata: {
        duration: 0,
        stepCount: this.stepRecorder.count,
        confidence: 1.0,
      },
    };
  }

  /**
   * Calcule toutes les statistiques descriptives
   */
  private computeAllStats(parsed: ParsedExpression): ComputationResult {
    const numbers = this.parseNumbers(parsed.expression);
    const sorted = [...numbers].sort((a, b) => a - b);
    const n = numbers.length;

    const sum = numbers.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const min = sorted[0];
    const max = sorted[n - 1];

    let median: number;
    if (n % 2 === 0) {
      median = (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    } else {
      median = sorted[Math.floor(n / 2)];
    }

    const variance = numbers.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);

    this.stepRecorder.add({
      description: "Descriptive statistics summary",
      inputLatex: `[${numbers.join(", ")}]`,
      outputLatex: `n=${n}, mean=${mean}, median=${median}, min=${min}, max=${max}, σ=${stdDev.toFixed(4)}`,
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "stats",
      result: `n=${n}, Mean=${mean}, Median=${median}, Min=${min}, Max=${max}, SD=${stdDev.toFixed(4)}`,
      resultLatex: `\\begin{aligned} n &= ${n} \\\\ \\bar{x} &= ${mean} \\\\ \\text{Median} &= ${median} \\\\ \\text{Min} &= ${min} \\\\ \\text{Max} &= ${max} \\\\ \\sigma &= ${stdDev.toFixed(4)} \\end{aligned}`,
      steps: this.stepRecorder.getAll(),
      metadata: {
        duration: 0,
        stepCount: this.stepRecorder.count,
        confidence: 1.0,
      },
    };
  }
}
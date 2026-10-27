// lib/ai/computation-engine/modules/trigonometry.ts

/**
 * Scientia Labs — Computation Engine
 * Module Trigonométrie : sin, cos, tan, inverses, conversions
 */

import { StepRecorder } from "../core/step-recorder";
import type { ParsedExpression } from "../core/parser";
import type { ComputationResult } from "../core/types";

export class TrigonometryModule {
  private stepRecorder: StepRecorder;

  constructor(stepRecorder: StepRecorder) {
    this.stepRecorder = stepRecorder;
  }

  /**
   * Point d'entrée du module trigonométrie
   */
  async execute(parsed: ParsedExpression): Promise<ComputationResult> {
    const expr = parsed.expression.toLowerCase();

    // Détecter le type d'opération trigonométrique
    if (expr.startsWith("sin(")) return this.evaluateTrig(parsed, "sin");
    if (expr.startsWith("cos(")) return this.evaluateTrig(parsed, "cos");
    if (expr.startsWith("tan(")) return this.evaluateTrig(parsed, "tan");
    if (expr.startsWith("asin(") || expr.startsWith("arcsin(")) return this.evaluateInverseTrig(parsed, "arcsin");
    if (expr.startsWith("acos(") || expr.startsWith("arccos(")) return this.evaluateInverseTrig(parsed, "arccos");
    if (expr.startsWith("atan(") || expr.startsWith("arctan(")) return this.evaluateInverseTrig(parsed, "arctan");
    if (expr.includes("to rad")) return this.convertToRadians(parsed);
    if (expr.includes("to deg")) return this.convertToDegrees(parsed);

    throw new Error(
      "Supported operations: sin(x), cos(x), tan(x), asin(x), acos(x), atan(x), x to rad, x to deg"
    );
  }

  /**
   * Évalue une fonction trigonométrique standard
   */
  private evaluateTrig(parsed: ParsedExpression, func: "sin" | "cos" | "tan"): ComputationResult {
    const angle = this.extractAngle(parsed.expression);
    const isDegrees = parsed.params?.unit === "deg";

    const angleRad = isDegrees ? this.toRadians(angle) : angle;
    const angleDisplay = isDegrees ? `${angle}°` : `${angle} rad`;

    this.stepRecorder.add({
      description: `Parse angle for ${func}()`,
      inputLatex: `${func}(${angleDisplay})`,
      outputLatex: isDegrees ? `Convert to radians: ${angleRad} rad` : `Angle in radians: ${angleRad}`,
    });

    let result: number;
    switch (func) {
      case "sin":
        result = Math.sin(angleRad);
        break;
      case "cos":
        result = Math.cos(angleRad);
        break;
      case "tan":
        result = Math.tan(angleRad);
        break;
    }

    this.stepRecorder.add({
      description: `Compute ${func}(${angleRad})`,
      inputLatex: `\\${func}(${angleRad})`,
      outputLatex: `${func}(${angleDisplay}) = ${result}`,
      rule: `${func}(θ) trigonometric evaluation`,
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "evaluate",
      result: `${func}(${angleDisplay}) = ${result}`,
      resultLatex: `\\${func}(${angleDisplay}) = ${result}`,
      steps: this.stepRecorder.getAll(),
      metadata: {
        duration: 0,
        stepCount: this.stepRecorder.count,
        confidence: 1.0,
      },
    };
  }

  /**
   * Évalue une fonction trigonométrique inverse
   */
  private evaluateInverseTrig(parsed: ParsedExpression, func: string): ComputationResult {
    const value = this.extractAngle(parsed.expression);
    const outputUnit = parsed.params?.unit || "rad";

    let resultRad: number;
    switch (func) {
      case "arcsin":
        if (value < -1 || value > 1) throw new Error("arcsin domain is [-1, 1]");
        resultRad = Math.asin(value);
        break;
      case "arccos":
        if (value < -1 || value > 1) throw new Error("arccos domain is [-1, 1]");
        resultRad = Math.acos(value);
        break;
      case "arctan":
        resultRad = Math.atan(value);
        break;
      default:
        throw new Error(`Unknown inverse function: ${func}`);
    }

    this.stepRecorder.add({
      description: `Compute ${func}(${value})`,
      inputLatex: `\\${func}(${value})`,
      outputLatex: `${resultRad} rad`,
      rule: `Inverse trigonometric function`,
    });

    if (outputUnit === "deg") {
      const resultDeg = this.toDegrees(resultRad);
      this.stepRecorder.add({
        description: "Convert result to degrees",
        inputLatex: `${resultRad} \\times \\frac{180}{\\pi}`,
        outputLatex: `${resultDeg}°`,
      });

      return {
        success: true,
        expression: parsed.expression,
        type: "evaluate",
        result: `${func}(${value}) = ${resultDeg}°`,
        resultLatex: `\\${func}(${value}) = ${resultDeg}°`,
        steps: this.stepRecorder.getAll(),
        metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
      };
    }

    return {
      success: true,
      expression: parsed.expression,
      type: "evaluate",
      result: `${func}(${value}) = ${resultRad} rad`,
      resultLatex: `\\${func}(${value}) = ${resultRad} \\text{ rad}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Convertit des degrés en radians
   */
  private convertToRadians(parsed: ParsedExpression): ComputationResult {
    const degrees = this.extractAngle(parsed.expression);
    const radians = this.toRadians(degrees);

    this.stepRecorder.add({
      description: "Convert degrees to radians: multiply by π/180",
      inputLatex: `${degrees}° \\times \\frac{\\pi}{180}`,
      outputLatex: `${radians} rad`,
      rule: "rad = deg × π/180",
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "convert",
      result: `${degrees}° = ${radians} rad`,
      resultLatex: `${degrees}° = ${radians} \\text{ rad}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Convertit des radians en degrés
   */
  private convertToDegrees(parsed: ParsedExpression): ComputationResult {
    const radians = this.extractAngle(parsed.expression);
    const degrees = this.toDegrees(radians);

    this.stepRecorder.add({
      description: "Convert radians to degrees: multiply by 180/π",
      inputLatex: `${radians} \\times \\frac{180}{\\pi}`,
      outputLatex: `${degrees}°`,
      rule: "deg = rad × 180/π",
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "convert",
      result: `${radians} rad = ${degrees}°`,
      resultLatex: `${radians} \\text{ rad} = ${degrees}°`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Extrait un angle numérique d'une expression
   */
  private extractAngle(expression: string): number {
    const match = expression.match(/(-?[\d.]+)/);
    if (!match) {
      throw new Error("Could not extract angle from expression");
    }
    return parseFloat(match[1]);
  }

  /**
   * Convertit des degrés en radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convertit des radians en degrés
   */
  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }
}
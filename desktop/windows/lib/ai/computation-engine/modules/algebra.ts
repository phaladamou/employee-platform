// lib/ai/computation-engine/modules/algebra.ts

/**
 * Scientia Labs — Computation Engine
 * Module Algèbre : résolution d'équations, systèmes linéaires, polynômes, arithmétique
 */

import { StepRecorder } from "../core/step-recorder";
import type { ParsedExpression } from "../core/parser";
import type { ComputationResult } from "../core/types";

export class AlgebraModule {
  private stepRecorder: StepRecorder;

  constructor(stepRecorder: StepRecorder) {
    this.stepRecorder = stepRecorder;
  }

  async execute(parsed: ParsedExpression): Promise<ComputationResult> {
    switch (parsed.type) {
      case "solve":
        return this.solveEquation(parsed);
      case "system":
        return this.solveSystem(parsed);
      case "evaluate":
        return this.evaluateExpression(parsed);
      case "simplify":
        return this.simplifyExpression(parsed);
      default:
        throw new Error(`Algebra module does not support type: ${parsed.type}`);
    }
  }

  private solveEquation(parsed: ParsedExpression): ComputationResult {
    const expr = parsed.expression;
    this.stepRecorder.add({
      description: "Parse equation",
      inputLatex: expr,
      outputLatex: `Analyzing: ${expr}`,
    });

    const quadraticMatch = expr.match(
      /([+-]?\d*\.?\d*)\s*\*?\s*x\s*\^\s*2\s*([+-]\s*\d*\.?\d*)\s*\*?\s*x\s*([+-]\s*\d*\.?\d*)\s*=\s*0/
    );

    if (quadraticMatch) {
      return this.solveQuadratic(quadraticMatch);
    }

    const linearMatch = expr.match(
      /([+-]?\d*\.?\d*)\s*\*?\s*x\s*([+-]\s*\d*\.?\d*)\s*=\s*0/
    );

    if (linearMatch) {
      return this.solveLinear(linearMatch);
    }

    throw new Error("Could not parse equation. Supported formats: ax² + bx + c = 0 or ax + b = 0");
  }

  private solveQuadratic(match: RegExpMatchArray): ComputationResult {
    const a = parseFloat(match[1]) || 1;
    const b = parseFloat(match[2].replace(/\s/g, "")) || 0;
    const c = parseFloat(match[3].replace(/\s/g, "")) || 0;

    this.stepRecorder.add({
      description: "Identify coefficients",
      inputLatex: `${a}x^2 + ${b}x + ${c} = 0`,
      outputLatex: `a = ${a}, b = ${b}, c = ${c}`,
    });

    const discriminant = b * b - 4 * a * c;

    this.stepRecorder.add({
      description: "Calculate discriminant Δ = b² - 4ac",
      inputLatex: `Δ = ${b}^2 - 4(${a})(${c})`,
      outputLatex: `Δ = ${discriminant}`,
      rule: "Quadratic formula discriminant",
    });

    if (discriminant > 0) {
      const x1 = (-b + Math.sqrt(discriminant)) / (2 * a);
      const x2 = (-b - Math.sqrt(discriminant)) / (2 * a);

      this.stepRecorder.add({
        description: "Apply quadratic formula: x = (-b ± √Δ) / 2a",
        inputLatex: `x = \\frac{-${b} \\pm \\sqrt{${discriminant}}}{2(${a})}`,
        outputLatex: `x_1 = ${x1}, x_2 = ${x2}`,
        rule: "Quadratic formula",
      });

      return {
        success: true,
        expression: `${a}x² + ${b}x + ${c} = 0`,
        type: "solve",
        result: `x₁ = ${x1}, x₂ = ${x2}`,
        resultLatex: `x_1 = ${x1},\\quad x_2 = ${x2}`,
        steps: this.stepRecorder.getAll(),
        metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
      };
    }

    if (discriminant === 0) {
      const x = -b / (2 * a);

      this.stepRecorder.add({
        description: "Double root: x = -b / 2a",
        inputLatex: `x = \\frac{-${b}}{2(${a})}`,
        outputLatex: `x = ${x}`,
        rule: "Double root (Δ = 0)",
      });

      return {
        success: true,
        expression: `${a}x² + ${b}x + ${c} = 0`,
        type: "solve",
        result: `x = ${x} (double)`,
        resultLatex: `x = ${x}\\text{ (double root)}`,
        steps: this.stepRecorder.getAll(),
        metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
      };
    }

    const realPart = -b / (2 * a);
    const imagPart = Math.sqrt(-discriminant) / (2 * a);

    this.stepRecorder.add({
      description: "Complex roots (Δ < 0)",
      inputLatex: `Δ = ${discriminant} < 0`,
      outputLatex: `x = ${realPart} ± ${imagPart}i`,
      rule: "Complex conjugate roots",
    });

    return {
      success: true,
      expression: `${a}x² + ${b}x + ${c} = 0`,
      type: "solve",
      result: `x₁ = ${realPart} + ${imagPart}i, x₂ = ${realPart} - ${imagPart}i`,
      resultLatex: `x_1 = ${realPart} + ${imagPart}i,\\quad x_2 = ${realPart} - ${imagPart}i`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  private solveLinear(match: RegExpMatchArray): ComputationResult {
    const a = parseFloat(match[1]) || 1;
    const b = parseFloat(match[2].replace(/\s/g, "")) || 0;

    this.stepRecorder.add({
      description: "Identify coefficients",
      inputLatex: `${a}x + ${b} = 0`,
      outputLatex: `a = ${a}, b = ${b}`,
    });

    this.stepRecorder.add({
      description: "Isolate x: x = -b / a",
      inputLatex: `x = \\frac{-${b}}{${a}}`,
      outputLatex: `x = ${-b / a}`,
      rule: "Linear equation solution",
    });

    return {
      success: true,
      expression: `${a}x + ${b} = 0`,
      type: "solve",
      result: `x = ${-b / a}`,
      resultLatex: `x = ${-b / a}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  private solveSystem(parsed: ParsedExpression): ComputationResult {
    this.stepRecorder.add({
      description: "Parse system of equations",
      inputLatex: parsed.expression,
      outputLatex: "Analyzing system...",
    });

    throw new Error("System solver not yet implemented");
  }

  private evaluateExpression(parsed: ParsedExpression): ComputationResult {
    const expr = parsed.expression;

    this.stepRecorder.add({
      description: "Evaluate arithmetic expression",
      inputLatex: expr,
      outputLatex: "Computing...",
    });

    // Nettoyer l'expression
    const sanitized = expr
      .replace(/\^/g, "**")
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/\s+/g, "");

    // Vérifier que l'expression ne contient que des caractères arithmétiques
    if (!/^[\d+\-*/().**]+$/.test(sanitized)) {
      throw new Error(
        "Expression contains non-arithmetic characters. For equations use type='solve', for derivatives use type='derivative'."
      );
    }

    const result = Function(`"use strict"; return (${sanitized})`)();

    this.stepRecorder.add({
      description: "Compute result",
      inputLatex: expr,
      outputLatex: String(result),
    });

    return {
      success: true,
      expression: expr,
      type: "evaluate",
      result: String(result),
      resultLatex: String(result),
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  private simplifyExpression(parsed: ParsedExpression): ComputationResult {
    this.stepRecorder.add({
      description: "Simplify expression",
      inputLatex: parsed.expression,
      outputLatex: "Simplifying...",
    });

    throw new Error("Simplification not yet implemented in algebra module. Use the symbolic module.");
  }
}
// lib/ai/computation-engine/modules/analysis.ts

/**
 * Scientia Labs — Computation Engine
 * Module Analyse : dérivées, intégrales, limites, séries de Taylor
 */

import { StepRecorder } from "../core/step-recorder";
import type { ParsedExpression } from "../core/parser";
import type { ComputationResult } from "../core/types";

export class AnalysisModule {
  private stepRecorder: StepRecorder;

  constructor(stepRecorder: StepRecorder) {
    this.stepRecorder = stepRecorder;
  }

  async execute(parsed: ParsedExpression): Promise<ComputationResult> {
    switch (parsed.type) {
      case "derivative":
        return this.computeDerivative(parsed);
      case "integral":
        return this.computeIntegral(parsed);
      case "limit":
        return this.computeLimit(parsed);
      case "taylor":
        return this.computeTaylor(parsed);
      default:
        throw new Error(`Analysis module does not support type: ${parsed.type}`);
    }
  }

  private computeDerivative(parsed: ParsedExpression): ComputationResult {
    const expr = parsed.expression;
    const variable = parsed.variable || "x";

    this.stepRecorder.add({
      description: `Parse polynomial for differentiation with respect to ${variable}`,
      inputLatex: expr,
      outputLatex: "Identifying terms...",
    });

    const terms = this.parsePolynomialTerms(expr);

    if (terms.length === 0) {
      throw new Error("Could not parse polynomial. Use format: ax^n + bx^m + ... + c");
    }

    const derivedTerms: string[] = [];
    const derivedTermsLatex: string[] = [];

    for (const term of terms) {
      const { coefficient, exponent } = term;

      if (exponent === 0) {
        this.stepRecorder.add({
          description: `Derivative of constant ${coefficient}`,
          inputLatex: `\\frac{d}{d${variable}} ${coefficient}`,
          outputLatex: "0",
          rule: "d/dx(c) = 0",
        });
        continue;
      }

      const newCoeff = coefficient * exponent;
      const newExp = exponent - 1;

      let derivedLatex = "";
      if (newExp === 0) {
        derivedLatex = `${newCoeff}`;
        derivedTerms.push(`${newCoeff}`);
        derivedTermsLatex.push(`${newCoeff}`);
      } else if (newExp === 1) {
        derivedLatex = `${newCoeff}${variable}`;
        derivedTerms.push(`${newCoeff}${variable}`);
        derivedTermsLatex.push(`${newCoeff}${variable}`);
      } else {
        derivedLatex = `${newCoeff}${variable}^{${newExp}}`;
        derivedTerms.push(`${newCoeff}${variable}^${newExp}`);
        derivedTermsLatex.push(`${newCoeff}${variable}^{${newExp}}`);
      }

      this.stepRecorder.add({
        description: `Derivative of ${coefficient}${variable}^${exponent}`,
        inputLatex: `\\frac{d}{d${variable}} ${coefficient}${variable}^{${exponent}}`,
        outputLatex: derivedLatex,
        rule: "d/dx(x^n) = n·x^(n-1)",
      });
    }

    const result = derivedTerms.join(" + ").replace(/\+ -/g, "- ") || "0";
    const resultLatex = derivedTermsLatex.join(" + ").replace(/\+ -/g, "- ") || "0";

    return {
      success: true,
      expression: expr,
      type: "derivative",
      result,
      resultLatex,
      steps: this.stepRecorder.getAll(),
      metadata: {
        duration: 0,
        stepCount: this.stepRecorder.count,
        confidence: 1.0,
      },
    };
  }

  private computeIntegral(parsed: ParsedExpression): ComputationResult {
    const expr = parsed.expression;
    const variable = parsed.variable || "x";

    this.stepRecorder.add({
      description: `Parse polynomial for integration with respect to ${variable}`,
      inputLatex: expr,
      outputLatex: "Identifying terms...",
    });

    const terms = this.parsePolynomialTerms(expr);

    if (terms.length === 0) {
      throw new Error("Could not parse polynomial. Use format: ax^n + bx^m + ... + c");
    }

    const integratedTerms: string[] = [];
    const integratedTermsLatex: string[] = [];

    for (const term of terms) {
      const { coefficient, exponent } = term;
      const newExp = exponent + 1;
      const newCoeff = coefficient / newExp;

      let integratedLatex = "";
      if (newExp === 1) {
        integratedLatex = `${newCoeff}${variable}`;
        integratedTerms.push(`${newCoeff}${variable}`);
        integratedTermsLatex.push(`${newCoeff}${variable}`);
      } else {
        integratedLatex = `\\frac{${coefficient}}{${newExp}}${variable}^{${newExp}}`;
        integratedTerms.push(`(${coefficient}/${newExp})${variable}^${newExp}`);
        integratedTermsLatex.push(`\\frac{${coefficient}}{${newExp}}${variable}^{${newExp}}`);
      }

      this.stepRecorder.add({
        description: `Integrate ${coefficient}${variable}^${exponent}`,
        inputLatex: `\\int ${coefficient}${variable}^{${exponent}} d${variable}`,
        outputLatex: integratedLatex,
        rule: "∫x^n dx = x^(n+1)/(n+1)",
      });
    }

    const result = integratedTerms.join(" + ").replace(/\+ -/g, "- ") + " + C";
    const resultLatex = integratedTermsLatex.join(" + ").replace(/\+ -/g, "- ") + " + C";

    this.stepRecorder.add({
      description: "Add constant of integration",
      inputLatex: "C",
      outputLatex: "+ C",
      rule: "Indefinite integral constant",
    });

    return {
      success: true,
      expression: expr,
      type: "integral",
      result,
      resultLatex,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  private computeLimit(parsed: ParsedExpression): ComputationResult {
    const expr = parsed.expression;
    const limitMatch = expr.match(/^(.+?)\s+(?:as|when)\s+(\w+)\s*→\s*(-?[\d.]+)$/i);

    if (!limitMatch) {
      throw new Error('Format expected: "expression as x→value" (e.g., "x^2 + 2x as x→3")');
    }

    const [, funcExpr, variable, targetStr] = limitMatch;
    const target = parseFloat(targetStr);

    const substituted = funcExpr
      .replace(new RegExp(`${variable}\\^(\\d+)`, "g"), `Math.pow(${target}, $1)`)
      .replace(new RegExp(`${variable}`, "g"), `(${target})`);

    this.stepRecorder.add({
      description: `Substitute ${variable} = ${target}`,
      inputLatex: funcExpr,
      outputLatex: `Evaluating at ${variable} = ${target}`,
    });

    this.stepRecorder.add({
      description: "Direct substitution (function is continuous)",
      inputLatex: substituted,
      outputLatex: "Computing...",
      rule: "lim x→a f(x) = f(a) for continuous functions",
    });

    const result = this.safeEval(substituted);

    return {
      success: true,
      expression: expr,
      type: "limit",
      result: String(result),
      resultLatex: `\\lim_{${variable} \\to ${target}} ${funcExpr} = ${result}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  private computeTaylor(parsed: ParsedExpression): ComputationResult {
    const expr = parsed.expression;
    const order = (parsed.params?.order as number) || 4;
    const point = (parsed.params?.point as number) || 0;

    this.stepRecorder.add({
      description: `Compute Taylor series of order ${order} around x = ${point}`,
      inputLatex: expr,
      outputLatex: "Computing derivatives...",
    });

    const taylorSeries: Record<string, string[]> = {
      sin: ["x", "x - x^3/6", "x - x^3/6 + x^5/120", "x - x^3/6 + x^5/120 - x^7/5040"],
      cos: ["1", "1 - x^2/2", "1 - x^2/2 + x^4/24", "1 - x^2/2 + x^4/24 - x^6/720"],
      exp: ["1 + x", "1 + x + x^2/2", "1 + x + x^2/2 + x^3/6", "1 + x + x^2/2 + x^3/6 + x^4/24"],
    };

    const funcName = expr.match(/^(\w+)/)?.[1]?.toLowerCase() || "";

    if (taylorSeries[funcName] && order >= 1 && order <= 4) {
      const series = taylorSeries[funcName][order - 1];

      this.stepRecorder.add({
        description: `Apply known Taylor series for ${funcName}(x)`,
        inputLatex: `${funcName}(x)`,
        outputLatex: series,
        rule: `Standard Taylor expansion of ${funcName}(x)`,
      });

      return {
        success: true,
        expression: expr,
        type: "taylor",
        result: series,
        resultLatex: `${funcName}(x) \\approx ${series}`,
        steps: this.stepRecorder.getAll(),
        metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
      };
    }

    throw new Error(
      `Taylor series currently supports sin(x), cos(x), e^x up to order 4. Requested: ${expr}`
    );
  }

  /**
   * Parse les termes d'un polynôme - CORRIGÉ
   */
  private parsePolynomialTerms(expr: string): Array<{ coefficient: number; exponent: number }> {
    const terms: Array<{ coefficient: number; exponent: number }> = [];

    // Normaliser
    let normalized = expr
      .replace(/\s+/g, "")
      .replace(/\*/g, "")
      .replace(/--/g, "+")
      .replace(/\+-/g, "-")
      .replace(/^\+/, "");

    if (!normalized.startsWith("-")) {
      normalized = "+" + normalized;
    }

    normalized = normalized.replace(/-/g, "+-");

    const termStrings = normalized.split("+").filter((t) => t.length > 0);

    for (const term of termStrings) {
      const isNegative = term.startsWith("-");
      const cleanTerm = isNegative ? term.substring(1) : term;

      if (cleanTerm.length === 0) continue;

      // Constante pure
      if (/^\d+\.?\d*$/.test(cleanTerm)) {
        const val = parseFloat(cleanTerm);
        terms.push({ coefficient: isNegative ? -val : val, exponent: 0 });
        continue;
      }

      // ax^n
      const powerMatch = cleanTerm.match(/^(\d*\.?\d*)([a-zA-Z])\^(\d+)$/);
      if (powerMatch) {
        let coeff = powerMatch[1] === "" ? 1 : parseFloat(powerMatch[1]);
        if (isNegative) coeff = -coeff;
        const exp = parseInt(powerMatch[3]);
        terms.push({ coefficient: coeff, exponent: exp });
        continue;
      }

      // ax
      const linearMatch = cleanTerm.match(/^(\d*\.?\d*)([a-zA-Z])$/);
      if (linearMatch) {
        let coeff = linearMatch[1] === "" ? 1 : parseFloat(linearMatch[1]);
        if (isNegative) coeff = -coeff;
        terms.push({ coefficient: coeff, exponent: 1 });
        continue;
      }

      // Juste la variable
      const varMatch = cleanTerm.match(/^([a-zA-Z])$/);
      if (varMatch) {
        terms.push({ coefficient: isNegative ? -1 : 1, exponent: 1 });
        continue;
      }
    }

    if (terms.length === 0) {
      const num = parseFloat(expr);
      if (!isNaN(num)) {
        terms.push({ coefficient: num, exponent: 0 });
      }
    }

    return terms;
  }

  private safeEval(expr: string): number {
    const sanitized = expr
      .replace(/Math\.pow\(/g, "Math.pow(")
      .replace(/\^/g, "**");

    if (/[^0-9+\-*/().%\sMath.pow]/.test(sanitized.replace(/Math\.pow/g, ""))) {
      throw new Error("Expression contains unauthorized functions");
    }

    return Function(`"use strict"; return (${sanitized})`)();
  }
}
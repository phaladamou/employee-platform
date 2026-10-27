// lib/ai/computation-engine/modules/symbolic.ts

/**
 * Scientia Labs — Computation Engine
 * Module Calcul Symbolique : simplification, substitution, factorisation
 */

import { StepRecorder } from "../core/step-recorder";
import type { ParsedExpression } from "../core/parser";
import type { ComputationResult } from "../core/types";

export class SymbolicModule {
  private stepRecorder: StepRecorder;

  constructor(stepRecorder: StepRecorder) {
    this.stepRecorder = stepRecorder;
  }

  /**
   * Point d'entrée du module symbolique
   */
  async execute(parsed: ParsedExpression): Promise<ComputationResult> {
    const expr = parsed.expression.toLowerCase();

    if (expr.startsWith("simplify(")) return this.simplifyExpression(parsed);
    if (expr.startsWith("substitute(") || expr.startsWith("sub(")) return this.substitute(parsed);
    if (expr.startsWith("expand(")) return this.expandExpression(parsed);
    if (expr.startsWith("factor(")) return this.factorExpression(parsed);
    if (expr.startsWith("degree(")) return this.getDegree(parsed);

    throw new Error(
      "Supported operations: simplify(), substitute(), expand(), factor(), degree()"
    );
  }

  /**
   * Simplifie une expression polynomiale
   * Combine les termes semblables
   */
  private simplifyExpression(parsed: ParsedExpression): ComputationResult {
    const inner = this.extractArgument(parsed.expression);
    const variable = parsed.variable || "x";

    this.stepRecorder.add({
      description: "Parse expression for simplification",
      inputLatex: inner,
      outputLatex: "Grouping like terms...",
    });

    // Parser les termes
    const terms = this.parseAllTerms(inner);
    const grouped = this.groupLikeTerms(terms);

    this.stepRecorder.add({
      description: "Group like terms (same power)",
      inputLatex: inner,
      outputLatex: this.termsToLatex(grouped),
      rule: "Combine terms with same exponent",
    });

    const simplified = this.termsToString(grouped);

    this.stepRecorder.add({
      description: "Write simplified expression",
      inputLatex: this.termsToLatex(grouped),
      outputLatex: simplified,
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "simplify",
      result: simplified,
      resultLatex: simplified,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Substitue une valeur dans une expression
   * Format : substitute(x^2 + 2x, x=3)
   */
  private substitute(parsed: ParsedExpression): ComputationResult {
    const match = parsed.expression.match(/sub(?:stitute)?$$(.+),\s*(\w+)\s*=\s*(-?[\d.]+)$$/i);
    if (!match) {
      throw new Error('Format: substitute(expression, variable=value)');
    }

    const [, inner, variable, valueStr] = match;
    const value = parseFloat(valueStr);

    this.stepRecorder.add({
      description: `Substitute ${variable} = ${value}`,
      inputLatex: inner,
      outputLatex: `Replacing ${variable} with ${value}...`,
    });

    // Remplacer la variable par sa valeur
    const substituted = inner
      .replace(new RegExp(`${variable}\\^(\\d+)`, "g"), `Math.pow(${value}, $1)`)
      .replace(new RegExp(`${variable}`, "g"), `(${value})`)
      .replace(/\^/g, "**");

    const result = this.safeEval(substituted);

    this.stepRecorder.add({
      description: "Evaluate the substituted expression",
      inputLatex: inner.replace(new RegExp(variable, "g"), String(value)),
      outputLatex: String(result),
      rule: "f(a) = evaluate f(x) at x = a",
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "evaluate",
      result: String(result),
      resultLatex: `f(${value}) = ${result}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Développe un produit de polynômes
   * Format : expand((x+1)(x+2)) → x² + 3x + 2
   */
  private expandExpression(parsed: ParsedExpression): ComputationResult {
    const inner = this.extractArgument(parsed.expression);

    this.stepRecorder.add({
      description: "Expand expression using distributive property",
      inputLatex: inner,
      outputLatex: "Applying FOIL/distributive property...",
    });

    // Support basique : (x+a)(x+b) = x² + (a+b)x + ab
    const binomialMatch = inner.match(/$$(\w+)\s*([+-]\d+)$$$$(\w+)\s*([+-]\d+)$$/);
    if (binomialMatch) {
      const [, var1, aStr, var2, bStr] = binomialMatch;
      const a = parseInt(aStr.replace(/\s/g, ""));
      const b = parseInt(bStr.replace(/\s/g, ""));
      const sum = a + b;
      const product = a * b;

      this.stepRecorder.add({
        description: "Apply (x+a)(x+b) = x² + (a+b)x + ab",
        inputLatex: `(${var1}${a >= 0 ? "+" : ""}${a})(${var2}${b >= 0 ? "+" : ""}${b})`,
        outputLatex: `${var1}^2 ${sum >= 0 ? "+" : ""} ${sum}${var1} ${product >= 0 ? "+" : ""} ${product}`,
        rule: "FOIL: First, Outer, Inner, Last",
      });

      return {
        success: true,
        expression: parsed.expression,
        type: "simplify",
        result: `${var1}^2 ${sum >= 0 ? "+" : ""} ${sum}${var1} ${product >= 0 ? "+" : ""} ${product}`,
        resultLatex: `${var1}^2 ${sum >= 0 ? "+" : ""} ${sum}${var1} ${product >= 0 ? "+" : ""} ${product}`,
        steps: this.stepRecorder.getAll(),
        metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
      };
    }

    throw new Error("Currently supports (x+a)(x+b) format for expansion");
  }

  /**
   * Factorise une expression quadratique simple
   * Format : factor(x^2 + 5x + 6) → (x+2)(x+3)
   */
  private factorExpression(parsed: ParsedExpression): ComputationResult {
    const inner = this.extractArgument(parsed.expression);

    this.stepRecorder.add({
      description: "Factor quadratic expression",
      inputLatex: inner,
      outputLatex: "Finding factors...",
    });

    // Chercher un pattern x² + bx + c
    const match = inner.match(/(\w+)\^2\s*([+-]\d+)\*?(\w+)\s*([+-]\d+)/);
    if (match) {
      const [, variable, bStr, , cStr] = match;
      const b = parseInt(bStr.replace(/\s/g, ""));
      const c = parseInt(cStr.replace(/\s/g, ""));

      // Trouver deux nombres dont la somme = b et le produit = c
      const factors = this.findFactors(b, c);

      if (factors) {
        const [p, q] = factors;

        this.stepRecorder.add({
          description: `Find numbers p, q such that p+q=${b} and p·q=${c}`,
          inputLatex: `p + q = ${b}, p \\cdot q = ${c}`,
          outputLatex: `p = ${p}, q = ${q}`,
          rule: "Factor by grouping",
        });

        const pSign = p >= 0 ? "+" : "";
        const qSign = q >= 0 ? "+" : "";

        this.stepRecorder.add({
          description: "Write factored form: (x+p)(x+q)",
          inputLatex: `${variable}^2 ${b >= 0 ? "+" : ""} ${b}${variable} ${c >= 0 ? "+" : ""} ${c}`,
          outputLatex: `(${variable}${pSign}${p})(${variable}${qSign}${q})`,
          rule: "x² + bx + c = (x+p)(x+q) where p+q=b, p·q=c",
        });

        return {
          success: true,
          expression: parsed.expression,
          type: "simplify",
          result: `(${variable}${pSign}${p})(${variable}${qSign}${q})`,
          resultLatex: `(${variable}${pSign}${p})(${variable}${qSign}${q})`,
          steps: this.stepRecorder.getAll(),
          metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
        };
      }
    }

    throw new Error("Could not factor. Currently supports x² + bx + c format with integer factors");
  }

  /**
   * Trouve le degré d'un polynôme
   */
  private getDegree(parsed: ParsedExpression): ComputationResult {
    const inner = this.extractArgument(parsed.expression);
    const terms = this.parseAllTerms(inner);

    let maxDegree = 0;
    for (const term of terms) {
      if (term.exponent > maxDegree) {
        maxDegree = term.exponent;
      }
    }

    this.stepRecorder.add({
      description: "Find highest exponent (degree)",
      inputLatex: inner,
      outputLatex: `Degree = ${maxDegree}`,
      rule: "Degree = max(exponent)",
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "evaluate",
      result: `Degree = ${maxDegree}`,
      resultLatex: `\\deg = ${maxDegree}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────

  /**
   * Extrait l'argument d'une fonction : f(x) → x
   */
  private extractArgument(expression: string): string {
    const match = expression.match(/$$([^)]+)$$/);
    if (!match) throw new Error("Could not extract argument");
    return match[1].trim();
  }

  /**
   * Parse tous les termes d'un polynôme
   */
  private parseAllTerms(expr: string): Term[] {
    const terms: Term[] = [];
    const normalized = expr.replace(/\s/g, "").replace(/-/g, "+-").replace(/\+{2,}/g, "+").replace(/^\++/, "");
    const termStrings = normalized.split("+").filter((t) => t.length > 0);

    for (const termStr of termStrings) {
      // Constante
      if (/^-?\d+\.?\d*$/.test(termStr)) {
        terms.push({ coefficient: parseFloat(termStr), exponent: 0 });
        continue;
      }

      // ax ou x
      if (/^-?\d*\.?\d*[a-zA-Z]$/.test(termStr) && !termStr.includes("^")) {
        const coeffMatch = termStr.match(/^(-?\d*\.?\d*)/);
        const coeff = coeffMatch?.[1] === "" || coeffMatch?.[1] === "-"
          ? (coeffMatch[1] === "-" ? -1 : 1)
          : parseFloat(coeffMatch?.[1] || "1");
        terms.push({ coefficient: coeff, exponent: 1 });
        continue;
      }

      // ax^n
      const match = termStr.match(/^(-?\d*\.?\d*)\*?[a-zA-Z]\^(-?\d+)$/);
      if (match) {
        const coeff = match[1] === "" || match[1] === "-"
          ? (match[1] === "-" ? -1 : 1)
          : parseFloat(match[1]);
        terms.push({ coefficient: coeff, exponent: parseInt(match[2]) });
        continue;
      }

      // x^n
      const simpleMatch = termStr.match(/^(-?)[a-zA-Z]\^(-?\d+)$/);
      if (simpleMatch) {
        terms.push({
          coefficient: simpleMatch[1] === "-" ? -1 : 1,
          exponent: parseInt(termStr.match(/\^(-?\d+)$/)![1]),
        });
      }
    }

    return terms;
  }

  /**
   * Groupe les termes par exposant
   */
  private groupLikeTerms(terms: Term[]): Map<number, number> {
    const grouped = new Map<number, number>();

    for (const term of terms) {
      const current = grouped.get(term.exponent) || 0;
      grouped.set(term.exponent, current + term.coefficient);
    }

    // Supprimer les termes avec coefficient 0
    for (const [exp, coeff] of grouped) {
      if (coeff === 0) grouped.delete(exp);
    }

    return grouped;
  }

  /**
   * Convertit les termes groupés en string
   */
  private termsToString(grouped: Map<number, number>): string {
    if (grouped.size === 0) return "0";

    const sortedExps = Array.from(grouped.keys()).sort((a, b) => b - a);
    const parts: string[] = [];

    for (const exp of sortedExps) {
      const coeff = grouped.get(exp)!;
      const sign = coeff >= 0 ? (parts.length === 0 ? "" : "+ ") : "- ";
      const absCoeff = Math.abs(coeff);

      if (exp === 0) {
        parts.push(`${sign}${absCoeff}`);
      } else if (exp === 1) {
        parts.push(`${sign}${absCoeff === 1 ? "" : absCoeff}x`);
      } else {
        parts.push(`${sign}${absCoeff === 1 ? "" : absCoeff}x^${exp}`);
      }
    }

    return parts.join(" ").replace(/^\+ /, "");
  }

  /**
   * Convertit les termes groupés en LaTeX
   */
  private termsToLatex(grouped: Map<number, number>): string {
    return this.termsToString(grouped);
  }

  /**
   * Trouve deux entiers p, q tels que p+q = sum et p·q = product
   */
  private findFactors(sum: number, product: number): [number, number] | null {
    const limit = Math.abs(product) + 1;
    for (let p = -limit; p <= limit; p++) {
      if (p === 0) continue;
      const q = product / p;
      if (Number.isInteger(q) && p + q === sum) {
        return [p, q];
      }
    }
    return null;
  }

  /**
   * Évalue une expression mathématique sécurisée
   */
  private safeEval(expr: string): number {
    const sanitized = expr.replace(/Math\.pow\(/g, "Math.pow(").replace(/\^/g, "**");
    if (/[^0-9+\-*/().%\sMath.pow]/.test(sanitized.replace(/Math\.pow/g, ""))) {
      throw new Error("Expression contains unauthorized functions");
    }
    return Function(`"use strict"; return (${sanitized})`)();
  }
}

interface Term {
  coefficient: number;
  exponent: number;
}
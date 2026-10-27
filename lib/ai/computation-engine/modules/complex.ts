// lib/ai/computation-engine/modules/complex.ts

/**
 * Scientia Labs — Computation Engine
 * Module Nombres Complexes : opérations, module, argument, forme polaire
 */

import { StepRecorder } from "../core/step-recorder";
import type { ParsedExpression } from "../core/parser";
import type { ComputationResult } from "../core/types";

export class ComplexModule {
  private stepRecorder: StepRecorder;

  constructor(stepRecorder: StepRecorder) {
    this.stepRecorder = stepRecorder;
  }

  /**
   * Point d'entrée du module nombres complexes
   */
  async execute(parsed: ParsedExpression): Promise<ComputationResult> {
    const expr = parsed.expression.toLowerCase();

    if (expr.includes("+") && expr.includes("i")) return this.parseAndEvaluate(parsed);
    if (expr.startsWith("mod(") || expr.startsWith("abs(")) return this.computeModulus(parsed);
    if (expr.startsWith("arg(")) return this.computeArgument(parsed);
    if (expr.startsWith("conj(")) return this.computeConjugate(parsed);
    if (expr.startsWith("polar(")) return this.toPolarForm(parsed);
    if (expr.startsWith("rect(")) return this.toRectangularForm(parsed);

    throw new Error(
      "Supported operations: a+bi (basic ops), mod(z), arg(z), conj(z), polar(z), rect(r,θ)"
    );
  }

  /**
   * Parse et évalue une expression complexe simple
   * Format : (a+bi) + (c+di), (a+bi) * (c+di), etc.
   */
  private parseAndEvaluate(parsed: ParsedExpression): ComputationResult {
    const expr = parsed.expression.replace(/\s/g, "");

    // Détecter l'opération
    let z1: ComplexNumber, z2: ComplexNumber, operation: string;

    if (expr.includes("+") && !expr.startsWith("+")) {
      // Addition ou soustraction
      const parts = expr.split(/(?=[+-])/).filter((p) => p.length > 0);
      if (parts.length >= 2) {
        z1 = this.parseComplex(parts[0]);
        z2 = this.parseComplex(parts[1]);
        operation = parts[1].startsWith("-") ? "subtract" : "add";
      } else {
        // C'est juste un nombre complexe seul
        z1 = this.parseComplex(expr);
        return this.describeComplex(z1, parsed);
      }
    } else if (expr.includes("*")) {
      const parts = expr.split("*");
      z1 = this.parseComplex(parts[0]);
      z2 = this.parseComplex(parts[1]);
      operation = "multiply";
    } else if (expr.includes("/")) {
      const parts = expr.split("/");
      z1 = this.parseComplex(parts[0]);
      z2 = this.parseComplex(parts[1]);
      operation = "divide";
    } else {
      z1 = this.parseComplex(expr);
      return this.describeComplex(z1, parsed);
    }

    return this.executeOperation(z1, z2, operation, parsed);
  }

  /**
   * Parse un nombre complexe depuis une chaîne
   * Supporte : a+bi, a-bi, bi, a, -a+bi
   */
  private parseComplex(str: string): ComplexNumber {
    str = str.replace(/\s/g, "");

    // Cas : bi ou -bi
    if (/^-?\d*\.?\d*i$/.test(str)) {
      const imag = parseFloat(str.replace("i", "")) || (str.startsWith("-") ? -1 : 1);
      return { real: 0, imag };
    }

    // Cas : a+bi
    const match = str.match(/^(-?\d*\.?\d*)([+-]\d*\.?\d*)i$/);
    if (match) {
      return {
        real: parseFloat(match[1]) || 0,
        imag: parseFloat(match[2]) || (match[2] === "+" ? 1 : -1),
      };
    }

    // Cas : réel pur
    if (/^-?\d*\.?\d*$/.test(str)) {
      return { real: parseFloat(str), imag: 0 };
    }

    throw new Error(`Could not parse complex number: ${str}`);
  }

  /**
   * Exécute une opération entre deux nombres complexes
   */
  private executeOperation(
    z1: ComplexNumber,
    z2: ComplexNumber,
    operation: string,
    parsed: ParsedExpression
  ): ComputationResult {
    let result: ComplexNumber;

    this.stepRecorder.add({
      description: `Parse complex numbers`,
      inputLatex: parsed.expression,
      outputLatex: `z_1 = ${this.formatComplex(z1)}, z_2 = ${this.formatComplex(z2)}`,
    });

    switch (operation) {
      case "add":
        result = { real: z1.real + z2.real, imag: z1.imag + z2.imag };
        this.stepRecorder.add({
          description: "Add real and imaginary parts",
          inputLatex: `(${z1.real} + ${z2.real}) + (${z1.imag} + ${z2.imag})i`,
          outputLatex: this.formatComplex(result),
          rule: "(a+bi) + (c+di) = (a+c) + (b+d)i",
        });
        break;
      case "subtract":
        result = { real: z1.real - z2.real, imag: z1.imag - z2.imag };
        this.stepRecorder.add({
          description: "Subtract real and imaginary parts",
          inputLatex: `(${z1.real} - ${z2.real}) + (${z1.imag} - ${z2.imag})i`,
          outputLatex: this.formatComplex(result),
          rule: "(a+bi) - (c+di) = (a-c) + (b-d)i",
        });
        break;
      case "multiply":
        result = {
          real: z1.real * z2.real - z1.imag * z2.imag,
          imag: z1.real * z2.imag + z1.imag * z2.real,
        };
        this.stepRecorder.add({
          description: "Apply FOIL: (a+bi)(c+di) = (ac-bd) + (ad+bc)i",
          inputLatex: `(${z1.real} \\cdot ${z2.real} - ${z1.imag} \\cdot ${z2.imag}) + (${z1.real} \\cdot ${z2.imag} + ${z1.imag} \\cdot ${z2.real})i`,
          outputLatex: this.formatComplex(result),
          rule: "(a+bi)(c+di) = (ac-bd) + (ad+bc)i",
        });
        break;
      case "divide":
        const denom = z2.real * z2.real + z2.imag * z2.imag;
        result = {
          real: (z1.real * z2.real + z1.imag * z2.imag) / denom,
          imag: (z1.imag * z2.real - z1.real * z2.imag) / denom,
        };
        this.stepRecorder.add({
          description: "Multiply numerator and denominator by conjugate",
          inputLatex: `\\frac{${this.formatComplex(z1)}}{${this.formatComplex(z2)}}`,
          outputLatex: this.formatComplex(result),
          rule: "(a+bi)/(c+di) = ((ac+bd) + (bc-ad)i) / (c²+d²)",
        });
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      success: true,
      expression: parsed.expression,
      type: "evaluate",
      result: this.formatComplex(result),
      resultLatex: this.formatComplexLatex(result),
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Décrit un nombre complexe (module, argument, conjugué)
   */
  private describeComplex(z: ComplexNumber, parsed: ParsedExpression): ComputationResult {
    const modulus = Math.sqrt(z.real * z.real + z.imag * z.imag);
    const argument = Math.atan2(z.imag, z.real);
    const conjugate = { real: z.real, imag: -z.imag };

    this.stepRecorder.add({
      description: "Complex number analysis",
      inputLatex: `z = ${this.formatComplex(z)}`,
      outputLatex: `|z| = ${modulus.toFixed(4)}, arg(z) = ${argument.toFixed(4)} rad`,
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "evaluate",
      result: `z = ${this.formatComplex(z)}, |z| = ${modulus.toFixed(4)}, arg(z) = ${argument.toFixed(4)} rad, z̄ = ${this.formatComplex(conjugate)}`,
      resultLatex: `\\begin{aligned} z &= ${this.formatComplexLatex(z)} \\\\ |z| &= ${modulus.toFixed(4)} \\\\ \\arg(z) &= ${argument.toFixed(4)} \\text{ rad} \\\\ \\bar{z} &= ${this.formatComplexLatex(conjugate)} \\end{aligned}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Calcule le module d'un nombre complexe
   */
  private computeModulus(parsed: ParsedExpression): ComputationResult {
    const z = this.extractComplex(parsed.expression);
    const modulus = Math.sqrt(z.real * z.real + z.imag * z.imag);

    this.stepRecorder.add({
      description: "Compute modulus |z| = √(a² + b²)",
      inputLatex: `|${this.formatComplex(z)}| = \\sqrt{${z.real}^2 + ${z.imag}^2}`,
      outputLatex: `|z| = ${modulus}`,
      rule: "|a+bi| = √(a² + b²)",
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "evaluate",
      result: `|z| = ${modulus}`,
      resultLatex: `|z| = ${modulus}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Calcule l'argument d'un nombre complexe
   */
  private computeArgument(parsed: ParsedExpression): ComputationResult {
    const z = this.extractComplex(parsed.expression);
    const argument = Math.atan2(z.imag, z.real);

    this.stepRecorder.add({
      description: "Compute argument θ = atan2(b, a)",
      inputLatex: `\\arg(${this.formatComplex(z)}) = \\text{atan2}(${z.imag}, ${z.real})`,
      outputLatex: `θ = ${argument} rad = ${argument * 180 / Math.PI}°`,
      rule: "arg(a+bi) = atan2(b, a)",
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "evaluate",
      result: `arg(z) = ${argument.toFixed(4)} rad (${(argument * 180 / Math.PI).toFixed(2)}°)`,
      resultLatex: `\\arg(z) = ${argument.toFixed(4)} \\text{ rad}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Calcule le conjugué
   */
  private computeConjugate(parsed: ParsedExpression): ComputationResult {
    const z = this.extractComplex(parsed.expression);
    const conj = { real: z.real, imag: -z.imag };

    this.stepRecorder.add({
      description: "Compute conjugate z̄ = a - bi",
      inputLatex: `\\bar{z} = ${this.formatComplex(z)}`,
      outputLatex: `z̄ = ${this.formatComplex(conj)}`,
      rule: "a+bi → a-bi",
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "evaluate",
      result: `z̄ = ${this.formatComplex(conj)}`,
      resultLatex: `\\bar{z} = ${this.formatComplexLatex(conj)}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Convertit en forme polaire
   */
  private toPolarForm(parsed: ParsedExpression): ComputationResult {
    const z = this.extractComplex(parsed.expression);
    const r = Math.sqrt(z.real * z.real + z.imag * z.imag);
    const theta = Math.atan2(z.imag, z.real);

    this.stepRecorder.add({
      description: "Convert to polar form: r(cos θ + i sin θ)",
      inputLatex: `z = ${this.formatComplex(z)}`,
      outputLatex: `r = ${r.toFixed(4)}, θ = ${theta.toFixed(4)} rad`,
      rule: "r = √(a²+b²), θ = atan2(b,a)",
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "convert",
      result: `z = ${r.toFixed(4)}(cos(${theta.toFixed(4)}) + i sin(${theta.toFixed(4)}))`,
      resultLatex: `z = ${r.toFixed(4)}(\\cos(${theta.toFixed(4)}) + i\\sin(${theta.toFixed(4)}))`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Convertit de la forme polaire à rectangulaire
   */
  private toRectangularForm(parsed: ParsedExpression): ComputationResult {
    const match = parsed.expression.match(/rect$$(\d+\.?\d*),\s*(\d+\.?\d*)$$/i);
    if (!match) throw new Error('Format: rect(r, θ) where θ is in radians');

    const r = parseFloat(match[1]);
    const theta = parseFloat(match[2]);
    const real = r * Math.cos(theta);
    const imag = r * Math.sin(theta);

    this.stepRecorder.add({
      description: "Convert from polar to rectangular",
      inputLatex: `r = ${r}, θ = ${theta}`,
      outputLatex: `z = ${real} + ${imag}i`,
      rule: "a = r cos θ, b = r sin θ",
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "convert",
      result: `z = ${this.formatComplex({ real, imag })}`,
      resultLatex: `z = ${this.formatComplexLatex({ real, imag })}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Extrait un nombre complexe d'une expression de type "mod(a+bi)"
   */
  private extractComplex(expression: string): ComplexNumber {
    const match = expression.match(/$$([^)]+)$$/);
    if (match) {
      return this.parseComplex(match[1]);
    }
    return this.parseComplex(expression);
  }

  /**
   * Formate un nombre complexe en texte
   */
  private formatComplex(z: ComplexNumber): string {
    if (z.imag === 0) return `${z.real}`;
    if (z.real === 0) return `${z.imag}i`;
    const sign = z.imag >= 0 ? "+" : "-";
    return `${z.real} ${sign} ${Math.abs(z.imag)}i`;
  }

  /**
   * Formate un nombre complexe en LaTeX
   */
  private formatComplexLatex(z: ComplexNumber): string {
    if (z.imag === 0) return `${z.real}`;
    if (z.real === 0) return `${z.imag}i`;
    const sign = z.imag >= 0 ? "+" : "-";
    return `${z.real} ${sign} ${Math.abs(z.imag)}i`;
  }
}

interface ComplexNumber {
  real: number;
  imag: number;
}
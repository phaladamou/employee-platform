// lib/ai/computation-engine/modules/matrix.ts

/**
 * Scientia Labs — Computation Engine
 * Module Matriciel : déterminant, inverse, valeurs propres, décompositions
 */

import { StepRecorder } from "../core/step-recorder";
import type { ParsedExpression } from "../core/parser";
import type { ComputationResult } from "../core/types";

export class MatrixModule {
  private stepRecorder: StepRecorder;

  constructor(stepRecorder: StepRecorder) {
    this.stepRecorder = stepRecorder;
  }

  /**
   * Point d'entrée du module matriciel
   */
  async execute(parsed: ParsedExpression): Promise<ComputationResult> {
    switch (parsed.type) {
      case "determinant":
        return this.computeDeterminant(parsed);
      case "inverse":
        return this.computeInverse(parsed);
      case "eigenvalues":
        return this.computeEigenvalues(parsed);
      default:
        throw new Error(`Matrix module does not support type: ${parsed.type}`);
    }
  }

  /**
   * Parse une matrice depuis une chaîne de caractères
   * Format : [[a,b],[c,d]] ou [a,b;c,d]
   */
  private parseMatrix(expression: string): number[][] {
    // Nettoyer l'expression
    const cleaned = expression
      .replace(/\s/g, "")
      .replace(/^\[/, "")
      .replace(/\]$/, "");

    // Split par lignes : [a,b] et [c,d]
    const rows = cleaned.split(/\],\[|;/);

    return rows.map((row) =>
      row
        .replace(/[\[\]]/g, "")
        .split(",")
        .map(Number)
    );
  }

  /**
   * Calcule le déterminant d'une matrice
   */
  private computeDeterminant(parsed: ParsedExpression): ComputationResult {
    const matrix = this.parseMatrix(parsed.expression);
    const n = matrix.length;

    this.stepRecorder.add({
      description: `Parse ${n}×${n} matrix`,
      inputLatex: parsed.expression,
      outputLatex: this.matrixToLatex(matrix),
    });

    // Vérifier que la matrice est carrée
    if (!matrix.every((row) => row.length === n)) {
      throw new Error("Matrix must be square to compute determinant");
    }

    let determinant: number;

    if (n === 1) {
      determinant = matrix[0][0];
      this.stepRecorder.add({
        description: "Determinant of 1×1 matrix is the element itself",
        inputLatex: `\\det(${this.matrixToLatex(matrix)})`,
        outputLatex: String(determinant),
      });
    } else if (n === 2) {
      const [[a, b], [c, d]] = matrix;
      determinant = a * d - b * c;

      this.stepRecorder.add({
        description: "Apply 2×2 determinant formula: ad - bc",
        inputLatex: `\\begin{vmatrix} ${a} & ${b} \\\\ ${c} & ${d} \\end{vmatrix}`,
        outputLatex: `${a} \\cdot ${d} - ${b} \\cdot ${c} = ${determinant}`,
        rule: "det(2×2) = ad - bc",
      });
    } else if (n === 3) {
      determinant = this.determinant3x3(matrix);

      this.stepRecorder.add({
        description: "Apply 3×3 determinant (Sarrus' rule)",
        inputLatex: this.matrixToLatex(matrix),
        outputLatex: String(determinant),
        rule: "Sarrus' rule",
      });
    } else {
      // Pour n > 3, utiliser l'expansion par cofacteurs
      determinant = this.determinantNxN(matrix);

      this.stepRecorder.add({
        description: `Compute ${n}×${n} determinant via cofactor expansion`,
        inputLatex: this.matrixToLatex(matrix),
        outputLatex: String(determinant),
        rule: "Laplace expansion",
      });
    }

    return {
      success: true,
      expression: parsed.expression,
      type: "determinant",
      result: String(determinant),
      resultLatex: `\\det = ${determinant}`,
      steps: this.stepRecorder.getAll(),
      metadata: {
        duration: 0,
        stepCount: this.stepRecorder.count,
        confidence: 1.0,
      },
    };
  }

  /**
   * Déterminant 3×3 par règle de Sarrus
   */
  private determinant3x3(m: number[][]): number {
    const [[a, b, c], [d, e, f], [g, h, i]] = m;

    const positive = a * e * i + b * f * g + c * d * h;
    const negative = c * e * g + b * d * i + a * f * h;

    this.stepRecorder.add({
      description: "Positive diagonals: aei + bfg + cdh",
      inputLatex: `${a}·${e}·${i} + ${b}·${f}·${g} + ${c}·${d}·${h}`,
      outputLatex: String(positive),
    });

    this.stepRecorder.add({
      description: "Negative diagonals: ceg + bdi + afh",
      inputLatex: `${c}·${e}·${g} + ${b}·${d}·${i} + ${a}·${f}·${h}`,
      outputLatex: String(negative),
    });

    return positive - negative;
  }

  /**
   * Déterminant N×N par expansion de Laplace (première ligne)
   */
  private determinantNxN(matrix: number[][]): number {
    const n = matrix.length;

    if (n === 1) return matrix[0][0];
    if (n === 2) return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];

    let det = 0;
    for (let j = 0; j < n; j++) {
      const cofactor = matrix[0][j] * this.determinantNxN(this.getMinor(matrix, 0, j));
      det += (j % 2 === 0 ? 1 : -1) * cofactor;
    }
    return det;
  }

  /**
   * Extrait le mineur (matrice sans la ligne i et la colonne j)
   */
  private getMinor(matrix: number[][], row: number, col: number): number[][] {
    return matrix
      .filter((_, i) => i !== row)
      .map((r) => r.filter((_, j) => j !== col));
  }

  /**
   * Calcule l'inverse d'une matrice 2×2
   */
  private computeInverse(parsed: ParsedExpression): ComputationResult {
    const matrix = this.parseMatrix(parsed.expression);
    const n = matrix.length;

    if (n !== 2) {
      throw new Error("Matrix inverse currently supports 2×2 matrices only");
    }

    const [[a, b], [c, d]] = matrix;
    const det = a * d - b * c;

    if (det === 0) {
      throw new Error("Matrix is not invertible (determinant = 0)");
    }

    this.stepRecorder.add({
      description: "Calculate determinant: ad - bc",
      inputLatex: `${a}·${d} - ${b}·${c}`,
      outputLatex: `det = ${det}`,
    });

    this.stepRecorder.add({
      description: "Apply 2×2 inverse formula: (1/det) · [[d, -b], [-c, a]]",
      inputLatex: `\\frac{1}{${det}} \\begin{bmatrix} ${d} & ${-b} \\\\ ${-c} & ${a} \\end{bmatrix}`,
      outputLatex: `\\begin{bmatrix} ${d / det} & ${-b / det} \\\\ ${-c / det} & ${a / det} \\end{bmatrix}`,
      rule: "A⁻¹ = (1/det) · adj(A)",
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "inverse",
      result: `[[${d / det}, ${-b / det}], [${-c / det}, ${a / det}]]`,
      resultLatex: `\\begin{bmatrix} ${d / det} & ${-b / det} \\\\ ${-c / det} & ${a / det} \\end{bmatrix}`,
      steps: this.stepRecorder.getAll(),
      metadata: {
        duration: 0,
        stepCount: this.stepRecorder.count,
        confidence: 1.0,
      },
    };
  }

  /**
   * Calcule les valeurs propres d'une matrice 2×2
   */
  private computeEigenvalues(parsed: ParsedExpression): ComputationResult {
    const matrix = this.parseMatrix(parsed.expression);

    if (matrix.length !== 2) {
      throw new Error("Eigenvalues currently supports 2×2 matrices only");
    }

    const [[a, b], [c, d]] = matrix;
    const trace = a + d;
    const det = a * d - b * c;
    const discriminant = trace * trace - 4 * det;

    this.stepRecorder.add({
      description: "Calculate trace: tr(A) = a + d",
      inputLatex: `\\text{tr} = ${a} + ${d}`,
      outputLatex: `tr = ${trace}`,
    });

    this.stepRecorder.add({
      description: "Calculate determinant: det(A) = ad - bc",
      inputLatex: `${a}·${d} - ${b}·${c}`,
      outputLatex: `det = ${det}`,
    });

    if (discriminant >= 0) {
      const lambda1 = (trace + Math.sqrt(discriminant)) / 2;
      const lambda2 = (trace - Math.sqrt(discriminant)) / 2;

      this.stepRecorder.add({
        description: "Apply characteristic equation: λ² - tr(A)λ + det(A) = 0",
        inputLatex: `\\lambda^2 - ${trace}\\lambda + ${det} = 0`,
        outputLatex: `\\lambda_1 = ${lambda1},\\quad \\lambda_2 = ${lambda2}`,
        rule: "Quadratic formula on characteristic polynomial",
      });

      return {
        success: true,
        expression: parsed.expression,
        type: "eigenvalues",
        result: `λ₁ = ${lambda1}, λ₂ = ${lambda2}`,
        resultLatex: `\\lambda_1 = ${lambda1},\\quad \\lambda_2 = ${lambda2}`,
        steps: this.stepRecorder.getAll(),
        metadata: {
          duration: 0,
          stepCount: this.stepRecorder.count,
          confidence: 1.0,
        },
      };
    }

    const realPart = trace / 2;
    const imagPart = Math.sqrt(-discriminant) / 2;

    this.stepRecorder.add({
      description: "Complex eigenvalues (discriminant < 0)",
      inputLatex: `\\Delta = ${discriminant} < 0`,
      outputLatex: `\\lambda = ${realPart} \\pm ${imagPart}i`,
      rule: "Complex conjugate eigenvalues",
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "eigenvalues",
      result: `λ₁ = ${realPart} + ${imagPart}i, λ₂ = ${realPart} - ${imagPart}i`,
      resultLatex: `\\lambda_1 = ${realPart} + ${imagPart}i,\\quad \\lambda_2 = ${realPart} - ${imagPart}i`,
      steps: this.stepRecorder.getAll(),
      metadata: {
        duration: 0,
        stepCount: this.stepRecorder.count,
        confidence: 1.0,
      },
    };
  }

  /**
   * Convertit une matrice en notation LaTeX
   */
  private matrixToLatex(matrix: number[][]): string {
    const rows = matrix.map((row) => row.join(" & ")).join(" \\\\ ");
    return `\\begin{bmatrix} ${rows} \\end{bmatrix}`;
  }
}
// lib/ai/computation-engine/core/parser.ts

/**
 * Scientia Labs — Computation Engine
 * Parser : analyse et valide les expressions mathématiques
 */

import type { ComputationRequest, ComputationType } from "./types";

export class ExpressionParser {
  /**
   * Parse une requête de calcul et extrait les informations nécessaires
   */
  parse(request: ComputationRequest): ParsedExpression {
    this.validate(request);

    return {
      type: request.type,
      expression: this.sanitize(request.expression),
      variable: request.variable ?? "x",
      params: request.params ?? {},
    };
  }

  /**
   * Valide la requête avant parsing
   */
  private validate(request: ComputationRequest): void {
    if (!request.expression || request.expression.trim().length === 0) {
      throw new ParserError("Expression cannot be empty");
    }

    if (request.expression.length > 2000) {
      throw new ParserError("Expression is too long (max 2000 characters)");
    }

    // Vérifier les caractères dangereux
    const dangerous = /[<>{}]/g;
    if (dangerous.test(request.expression)) {
      throw new ParserError("Expression contains invalid characters");
    }
  }

  /**
   * Nettoie et normalise l'expression
   */
  private sanitize(expression: string): string {
    return expression
      .trim()
      .replace(/\s+/g, " ") // Normalise les espaces
      .replace(/\^/g, "^") // Garde les puissances
      .replace(/×/g, "*") // × → *
      .replace(/÷/g, "/") // ÷ → /
      .replace(/−/g, "-"); // − (unicode) → -
  }
}

export interface ParsedExpression {
  type: ComputationType;
  expression: string;
  variable: string;
  params: Record<string, unknown>;
}

export class ParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParserError";
  }
}

// lib/ai/computation-engine/core/evaluator.ts

/**
 * Scientia Labs — Computation Engine
 * Évaluateur : orchestre le routage vers les modules spécialisés
 */

import type { ComputationRequest, ComputationResult } from "./types";
import { StepRecorder } from "./step-recorder";
import { ExpressionParser } from "./parser";
import { ComputationSandbox } from "../security/sandbox";
import { ExpressionValidator } from "../security/validator";
import { AlgebraModule } from "../modules/algebra";
import { MatrixModule } from "../modules/matrix";
import { AnalysisModule } from "../modules/analysis";
import { StatisticsModule } from "../modules/statistics";
import { TrigonometryModule } from "../modules/trigonometry";
import { ComplexModule } from "../modules/complex";
import { SymbolicModule } from "../modules/symbolic";
import { UnitsModule } from "../modules/units";
import { ConstantsModule } from "../modules/constants";

export class ComputationEvaluator {
  private parser: ExpressionParser;
  private sandbox: ComputationSandbox;
  private validator: ExpressionValidator;
  private stepRecorder: StepRecorder;

  // Modules
  private algebra: AlgebraModule;
  private matrix: MatrixModule;
  private analysis: AnalysisModule;
  private statistics: StatisticsModule;
  private trigonometry: TrigonometryModule;
  private complex: ComplexModule;
  private symbolic: SymbolicModule;
  private units: UnitsModule;
  private constants: ConstantsModule;

  constructor() {
    this.parser = new ExpressionParser();
    this.sandbox = new ComputationSandbox();
    this.validator = new ExpressionValidator();
    this.stepRecorder = new StepRecorder();

    // Initialiser les modules avec le stepRecorder partagé
    this.algebra = new AlgebraModule(this.stepRecorder);
    this.matrix = new MatrixModule(this.stepRecorder);
    this.analysis = new AnalysisModule(this.stepRecorder);
    this.statistics = new StatisticsModule(this.stepRecorder);
    this.trigonometry = new TrigonometryModule(this.stepRecorder);
    this.complex = new ComplexModule(this.stepRecorder);
    this.symbolic = new SymbolicModule(this.stepRecorder);
    this.units = new UnitsModule(this.stepRecorder);
    this.constants = new ConstantsModule(this.stepRecorder);
  }

  /**
   * Évalue une requête de calcul et retourne le résultat avec étapes
   */
  async evaluate(request: ComputationRequest): Promise<ComputationResult> {
    const startTime = performance.now();

    try {
      // 1. Valider l'expression
      const validation = this.validator.validate(request.expression);
      if (!validation.valid) {
        throw new Error(validation.reason || "Invalid expression");
      }

      // 2. Parser l'expression
      const parsed = this.parser.parse(request);

      // 3. Réinitialiser l'enregistreur d'étapes
      this.stepRecorder.reset();

      // 4. Exécuter dans le bac à sable
      const result = await this.sandbox.execute(async () => {
        return this.route(parsed);
      });

      const duration = performance.now() - startTime;

      // Si le résultat est déjà un ComputationResult, le retourner
      if (this.isComputationResult(result)) {
        return {
          ...result,
          metadata: {
            ...result.metadata,
            duration: Math.round(duration),
          },
        };
      }

      // Sinon, construire un résultat simple
      return {
        success: true,
        expression: parsed.expression,
        type: parsed.type,
        result: String(result),
        resultLatex: String(result),
        steps: this.stepRecorder.getAll(),
        metadata: {
          duration: Math.round(duration),
          stepCount: this.stepRecorder.count,
          confidence: 1.0,
        },
      };
    } catch (error) {
      const duration = performance.now() - startTime;

      return {
        success: false,
        expression: request.expression,
        type: request.type,
        result: "",
        resultLatex: "",
        steps: this.stepRecorder.getAll(),
        metadata: {
          duration: Math.round(duration),
          stepCount: this.stepRecorder.count,
          confidence: 0,
        },
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Route la requête vers le bon module selon le type d'opération
   */
  private async route(parsed: ReturnType<ExpressionParser["parse"]>): Promise<ComputationResult | unknown> {
    switch (parsed.type) {
      // Algèbre
      case "solve":
      case "system":
        return this.algebra.execute(parsed);

      // Matrices
      case "determinant":
      case "inverse":
      case "eigenvalues":
        return this.matrix.execute(parsed);

      // Analyse
      case "derivative":
      case "integral":
      case "limit":
      case "taylor":
        return this.analysis.execute(parsed);

      // Statistiques
      case "stats":
        return this.statistics.execute(parsed);

      // Trigonométrie & Complexes & Symbolique & Unités & Constantes
      case "evaluate":
        return this.routeEvaluate(parsed);

      // Simplification symbolique
      case "simplify":
        return this.symbolic.execute(parsed);

      // Conversion d'unités
      case "convert":
        return this.units.execute(parsed);

      default:
        throw new Error(`Unknown computation type: ${parsed.type}`);
    }
  }

  /**
   * Route une évaluation vers le module approprié selon l'expression
   */
  private async routeEvaluate(parsed: ReturnType<ExpressionParser["parse"]>): Promise<ComputationResult> {
    const expr = parsed.expression.toLowerCase();

    // Constantes
    if (this.isConstantsQuery(expr)) {
      return this.constants.execute(parsed);
    }

    // Trigonométrie
    if (this.isTrigQuery(expr)) {
      return this.trigonometry.execute(parsed);
    }

    // Nombres complexes
    if (this.isComplexQuery(expr)) {
      return this.complex.execute(parsed);
    }

    // Symbolique (substitution, factorisation, degré)
    if (this.isSymbolicQuery(expr)) {
      return this.symbolic.execute(parsed);
    }

    // Statistiques
    if (this.isStatsQuery(expr)) {
      return this.statistics.execute(parsed);
    }

    // Algèbre (évaluation simple)
    return this.algebra.execute(parsed);
  }

  // ─── Détecteurs de type ──────────────────────────────────────

  private isConstantsQuery(expr: string): boolean {
    const allConstants = [
      "pi", "e", "phi", "sqrt2", "ln2", "ln10", "gamma",
      "c", "h", "hbar", "G", "k_B", "N_A", "e_charge",
      "m_e", "m_p", "m_n", "epsilon_0", "mu_0", "R", "sigma", "alpha",
      "list", "math", "physics",
    ];
    return allConstants.some((c) => expr === c || expr.startsWith(c));
  }

  private isTrigQuery(expr: string): boolean {
    return /^(sin|cos|tan|asin|acos|atan|arcsin|arccos|arctan)\(/.test(expr) ||
      /\d+\s*(deg|rad|°)/.test(expr) ||
      /to\s+(rad|deg)/i.test(expr);
  }

  private isComplexQuery(expr: string): boolean {
    return /\di/.test(expr) ||
      /^(mod|abs|arg|conj|polar|rect)\(/.test(expr) ||
      (/[+-]/.test(expr) && /i/.test(expr));
  }

  private isSymbolicQuery(expr: string): boolean {
    return /^(simplify|substitute|sub|expand|factor|degree)\(/.test(expr);
  }

  private isStatsQuery(expr: string): boolean {
    return /^(mean|average|median|mode|var|variance|std|stdev|stats|describe)\(/.test(expr);
  }

  /**
   * Vérifie si un objet est un ComputationResult
   */
  private isComputationResult(obj: unknown): obj is ComputationResult {
    return (
      typeof obj === "object" &&
      obj !== null &&
      "success" in obj &&
      "expression" in obj &&
      "type" in obj &&
      "steps" in obj
    );
  }

  /**
   * Retourne l'enregistreur d'étapes (pour usage externe)
   */
  getStepRecorder(): StepRecorder {
    return this.stepRecorder;
  }
}
// lib/ai/tools/calculate.ts

/**
 * Scientia Labs — Calculate Tool
 * Outil de calcul scientifique pour l'IA
 * Appelé volontairement par l'IA, comme webSearch
 */

import { tool } from "ai";
import { z } from "zod";
import { computationEngine } from "@/lib/ai/computation-engine";
import type { ComputationType } from "@/lib/ai/computation-engine/core/types";

const validTypes = [
  "evaluate", "derivative", "integral", "limit", "solve",
  "system", "determinant", "inverse", "eigenvalues",
  "simplify", "taylor", "convert", "stats",
] as const;

export const calculate = ({ dataStream }: { dataStream: any }) =>
  tool({
    description: `MANDATORY for any mathematical computation. You MUST use this tool for ALL math — even simple arithmetic like 2+2. You are NOT capable of computing math accurately yourself. This tool provides exact, step-by-step results with proper LaTeX formatting that you cannot generate. Use this whenever the user asks anything involving numbers, equations, formulas, or calculations.`,

    inputSchema: z.object({
      type: z.string().describe("The type of mathematical operation: evaluate, derivative, integral, limit, solve, system, determinant, inverse, eigenvalues, simplify, taylor, convert, stats"),
      expression: z.string().describe("The mathematical expression to compute"),
      variable: z.string().optional().describe("The variable (default: x)"),
    }),

    execute: async ({ type, expression, variable }) => {
      console.log("🔧 CALCULATE TOOL CALLED BY AI:", { type, expression, variable });

      if (!validTypes.includes(type as typeof validTypes[number])) {
        console.log("❌ CALCULATE TOOL - INVALID TYPE:", type);
        return {
          error: `Invalid type: "${type}". Must be one of: ${validTypes.join(", ")}`,
          expression,
          type,
        };
      }

      console.log("🚀 CALLING COMPUTATION ENGINE...");
      const result = await computationEngine.execute({
        type: type as ComputationType,
        expression,
        variable,
      });

      console.log("📊 COMPUTATION ENGINE RESULT:", {
        success: result.success,
        result: result.result,
        error: result.error,
      });

      if (!result.success) {
        return {
          error: result.error || "Computation failed",
          expression,
          type,
        };
      }

      // Écrire la trace scientifique dans le flux pour l'affichage
      if (dataStream) {
        console.log("📝 WRITING SCIENTIFIC TRACE TO DATASTREAM");
        dataStream.write({
          type: "data-scientific-trace",
          data: {
            engineName: "Symbolic Mathematics Core v1.0",
            expression,
            steps: result.steps.map((s) => ({
              description: s.description,
              status: "done" as const,
            })),
            result: result.result,
            duration: result.metadata.duration,
            confidence: Math.round(result.metadata.confidence * 100),
          },
        });
      }

      return {
        expression: result.expression,
        type: result.type,
        result: result.result,
        resultLatex: result.resultLatex,
        steps: result.steps.map((step) => ({
          step: step.step,
          description: step.description,
          input: step.inputLatex,
          output: step.outputLatex,
          rule: step.rule,
        })),
        stepCount: result.metadata.stepCount,
        confidence: result.metadata.confidence,
      };
    },
  });
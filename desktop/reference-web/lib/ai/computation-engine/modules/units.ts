// lib/ai/computation-engine/modules/units.ts

/**
 * Scientia Labs — Computation Engine
 * Module Unités : conversions d'unités scientifiques
 */

import { StepRecorder } from "../core/step-recorder";
import type { ParsedExpression } from "../core/parser";
import type { ComputationResult } from "../core/types";

export class UnitsModule {
  private stepRecorder: StepRecorder;

  // Facteurs de conversion vers l'unité de base
  private readonly lengthToMeters: Record<string, number> = {
    m: 1,
    km: 1000,
    cm: 0.01,
    mm: 0.001,
    μm: 0.000001,
    nm: 0.000000001,
    ft: 0.3048,
    in: 0.0254,
    yd: 0.9144,
    mi: 1609.344,
    nmi: 1852,
  };

  private readonly massToKg: Record<string, number> = {
    kg: 1,
    g: 0.001,
    mg: 0.000001,
    μg: 0.000000001,
    lb: 0.453592,
    oz: 0.0283495,
    ton: 1000,
  };

  private readonly timeToSeconds: Record<string, number> = {
    s: 1,
    min: 60,
    h: 3600,
    day: 86400,
    week: 604800,
    month: 2592000,
    year: 31536000,
  };

  private readonly tempFormulas: Record<string, (value: number) => number> = {
    "c->f": (c) => c * 9 / 5 + 32,
    "f->c": (f) => (f - 32) * 5 / 9,
    "c->k": (c) => c + 273.15,
    "k->c": (k) => k - 273.15,
    "f->k": (f) => (f - 32) * 5 / 9 + 273.15,
    "k->f": (k) => (k - 273.15) * 9 / 5 + 32,
  };

  constructor(stepRecorder: StepRecorder) {
    this.stepRecorder = stepRecorder;
  }

  /**
   * Point d'entrée du module unités
   */
  async execute(parsed: ParsedExpression): Promise<ComputationResult> {
    const expr = parsed.expression;

    // Détecter le type de conversion
    if (this.isTemperatureConversion(expr)) return this.convertTemperature(parsed);
    if (this.isLengthConversion(expr)) return this.convertLength(parsed);
    if (this.isMassConversion(expr)) return this.convertMass(parsed);
    if (this.isTimeConversion(expr)) return this.convertTime(parsed);

    throw new Error(
      "Supported conversions: length (m, km, cm, mm, ft, in, mi), mass (kg, g, lb, oz), time (s, min, h, day), temperature (C, F, K)"
    );
  }

  // ─── Length ──────────────────────────────────────────────────────

  private isLengthConversion(expr: string): boolean {
    const units = Object.keys(this.lengthToMeters).join("|");
    return new RegExp(`(\\d+\\.?\\d*)\\s*(${units})\\s+(?:to|in)\\s+(${units})`, "i").test(expr);
  }

  private convertLength(parsed: ParsedExpression): ComputationResult {
    const match = parsed.expression.match(/(\d+\.?\d*)\s*(\w+)\s+(?:to|in)\s+(\w+)/i);
    if (!match) throw new Error("Format: 5 km to miles");

    const [, valueStr, fromUnit, toUnit] = match;
    return this.convert(
      parseFloat(valueStr),
      fromUnit.toLowerCase(),
      toUnit.toLowerCase(),
      this.lengthToMeters,
      parsed
    );
  }

  // ─── Mass ────────────────────────────────────────────────────────

  private isMassConversion(expr: string): boolean {
    const units = Object.keys(this.massToKg).join("|");
    return new RegExp(`(\\d+\\.?\\d*)\\s*(${units})\\s+(?:to|in)\\s+(${units})`, "i").test(expr);
  }

  private convertMass(parsed: ParsedExpression): ComputationResult {
    const match = parsed.expression.match(/(\d+\.?\d*)\s*(\w+)\s+(?:to|in)\s+(\w+)/i);
    if (!match) throw new Error("Format: 10 kg to lbs");

    const [, valueStr, fromUnit, toUnit] = match;
    return this.convert(
      parseFloat(valueStr),
      fromUnit.toLowerCase(),
      toUnit.toLowerCase(),
      this.massToKg,
      parsed
    );
  }

  // ─── Time ────────────────────────────────────────────────────────

  private isTimeConversion(expr: string): boolean {
    const units = Object.keys(this.timeToSeconds).join("|");
    return new RegExp(`(\\d+\\.?\\d*)\\s*(${units})\\s+(?:to|in)\\s+(${units})`, "i").test(expr);
  }

  private convertTime(parsed: ParsedExpression): ComputationResult {
    const match = parsed.expression.match(/(\d+\.?\d*)\s*(\w+)\s+(?:to|in)\s+(\w+)/i);
    if (!match) throw new Error("Format: 120 min to hours");

    const [, valueStr, fromUnit, toUnit] = match;
    return this.convert(
      parseFloat(valueStr),
      fromUnit.toLowerCase(),
      toUnit.toLowerCase(),
      this.timeToSeconds,
      parsed
    );
  }

  // ─── Temperature ────────────────────────────────────────────────

  private isTemperatureConversion(expr: string): boolean {
    return /(\d+\.?\d*)\s*°?\s*([CFK])\s+(?:to|in)\s+°?\s*([CFK])/i.test(expr);
  }

  private convertTemperature(parsed: ParsedExpression): ComputationResult {
    const match = parsed.expression.match(/(\d+\.?\d*)\s*°?\s*([CFK])\s+(?:to|in)\s+°?\s*([CFK])/i);
    if (!match) throw new Error("Format: 100 C to F");

    const value = parseFloat(match[1]);
    const from = match[2].toUpperCase();
    const to = match[3].toUpperCase();

    const key = `${from.toLowerCase()}->${to.toLowerCase()}`;
    const formula = this.tempFormulas[key];

    if (!formula) {
      throw new Error(`Temperature conversion ${from} to ${to} not supported`);
    }

    const result = formula(value);

    this.stepRecorder.add({
      description: `Convert ${value}°${from} to °${to}`,
      inputLatex: `${value}°${from}`,
      outputLatex: `${result.toFixed(2)}°${to}`,
      rule: this.getTempRule(from, to),
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "convert",
      result: `${value}°${from} = ${result.toFixed(2)}°${to}`,
      resultLatex: `${value}°\\text{${from}} = ${result.toFixed(2)}°\\text{${to}}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  // ─── Generic converter ──────────────────────────────────────────

  private convert(
    value: number,
    fromUnit: string,
    toUnit: string,
    table: Record<string, number>,
    parsed: ParsedExpression
  ): ComputationResult {
    if (!table[fromUnit]) throw new Error(`Unknown unit: ${fromUnit}`);
    if (!table[toUnit]) throw new Error(`Unknown unit: ${toUnit}`);

    this.stepRecorder.add({
      description: `Convert ${value} ${fromUnit} to base unit`,
      inputLatex: `${value} \\text{ ${fromUnit}}`,
      outputLatex: `${value} × ${table[fromUnit]} = ${value * table[fromUnit]} (base)`,
    });

    const baseValue = value * table[fromUnit];
    const result = baseValue / table[toUnit];

    this.stepRecorder.add({
      description: `Convert from base unit to ${toUnit}`,
      inputLatex: `${baseValue} \\div ${table[toUnit]}`,
      outputLatex: `${result} ${toUnit}`,
      rule: `1 ${toUnit} = ${table[toUnit]} base units`,
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "convert",
      result: `${value} ${fromUnit} = ${result} ${toUnit}`,
      resultLatex: `${value} \\text{ ${fromUnit}} = ${result} \\text{ ${toUnit}}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Retourne la règle de conversion de température
   */
  private getTempRule(from: string, to: string): string {
    const rules: Record<string, string> = {
      "c->f": "°F = (°C × 9/5) + 32",
      "f->c": "°C = (°F - 32) × 5/9",
      "c->k": "K = °C + 273.15",
      "k->c": "°C = K - 273.15",
      "f->k": "K = (°F - 32) × 5/9 + 273.15",
      "k->f": "°F = (K - 273.15) × 9/5 + 32",
    };
    return rules[`${from.toLowerCase()}->${to.toLowerCase()}`] || "";
  }
}
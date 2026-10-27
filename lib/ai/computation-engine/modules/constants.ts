// lib/ai/computation-engine/modules/constants.ts

/**
 * Scientia Labs — Computation Engine
 * Module Constantes : constantes physiques et mathématiques fondamentales
 */

import { StepRecorder } from "../core/step-recorder";
import type { ParsedExpression } from "../core/parser";
import type { ComputationResult } from "../core/types";

export class ConstantsModule {
  private stepRecorder: StepRecorder;

  // Constantes mathématiques
  private readonly mathConstants: Record<string, ConstantDefinition> = {
    pi: { value: Math.PI, symbol: "π", latex: "\\pi", description: "Ratio of circumference to diameter" },
    e: { value: Math.E, symbol: "e", latex: "e", description: "Euler's number, base of natural logarithm" },
    phi: { value: 1.618033988749895, symbol: "φ", latex: "\\varphi", description: "Golden ratio" },
    sqrt2: { value: Math.SQRT2, symbol: "√2", latex: "\\sqrt{2}", description: "Square root of 2" },
    ln2: { value: Math.LN2, symbol: "ln(2)", latex: "\\ln 2", description: "Natural log of 2" },
    ln10: { value: Math.LN10, symbol: "ln(10)", latex: "\\ln 10", description: "Natural log of 10" },
    gamma: { value: 0.5772156649015329, symbol: "γ", latex: "\\gamma", description: "Euler-Mascheroni constant" },
  };

  // Constantes physiques fondamentales (SI)
  private readonly physicalConstants: Record<string, ConstantDefinition> = {
    c: { value: 299792458, symbol: "c", latex: "c", description: "Speed of light in vacuum (m/s)" },
    h: { value: 6.62607015e-34, symbol: "h", latex: "h", description: "Planck constant (J·s)" },
    hbar: { value: 1.054571817e-34, symbol: "ħ", latex: "\\hbar", description: "Reduced Planck constant (J·s)" },
    G: { value: 6.67430e-11, symbol: "G", latex: "G", description: "Gravitational constant (m³/kg·s²)" },
    k_B: { value: 1.380649e-23, symbol: "k_B", latex: "k_B", description: "Boltzmann constant (J/K)" },
    N_A: { value: 6.02214076e23, symbol: "N_A", latex: "N_A", description: "Avogadro constant (mol⁻¹)" },
    e_charge: { value: 1.602176634e-19, symbol: "e", latex: "e", description: "Elementary charge (C)" },
    m_e: { value: 9.10938356e-31, symbol: "m_e", latex: "m_e", description: "Electron mass (kg)" },
    m_p: { value: 1.67262192369e-27, symbol: "m_p", latex: "m_p", description: "Proton mass (kg)" },
    m_n: { value: 1.67492749804e-27, symbol: "m_n", latex: "m_n", description: "Neutron mass (kg)" },
    epsilon_0: { value: 8.8541878128e-12, symbol: "ε₀", latex: "\\varepsilon_0", description: "Vacuum permittivity (F/m)" },
    mu_0: { value: 1.25663706212e-6, symbol: "μ₀", latex: "\\mu_0", description: "Vacuum permeability (N/A²)" },
    R: { value: 8.314462618, symbol: "R", latex: "R", description: "Ideal gas constant (J/mol·K)" },
    sigma: { value: 5.670374419e-8, symbol: "σ", latex: "\\sigma", description: "Stefan-Boltzmann constant (W/m²·K⁴)" },
    alpha: { value: 7.2973525693e-3, symbol: "α", latex: "\\alpha", description: "Fine-structure constant" },
  };

  constructor(stepRecorder: StepRecorder) {
    this.stepRecorder = stepRecorder;
  }

  /**
   * Point d'entrée du module constantes
   */
  async execute(parsed: ParsedExpression): Promise<ComputationResult> {
    const expr = parsed.expression.toLowerCase().trim();

    // Lister toutes les constantes
    if (expr === "list" || expr === "all") {
      return this.listAllConstants();
    }

    // Lister les constantes mathématiques
    if (expr === "math" || expr === "mathematical") {
      return this.listMathConstants();
    }

    // Lister les constantes physiques
    if (expr === "physics" || expr === "physical") {
      return this.listPhysicalConstants();
    }

    // Chercher une constante spécifique
    return this.getConstant(expr, parsed);
  }

  /**
   * Liste toutes les constantes disponibles
   */
  private listAllConstants(): ComputationResult {
    const all = { ...this.mathConstants, ...this.physicalConstants };

    this.stepRecorder.add({
      description: "Available mathematical and physical constants",
      inputLatex: "Scientia Labs Constants",
      outputLatex: `${Object.keys(all).length} constants available`,
    });

    const mathList = Object.entries(this.mathConstants)
      .map(([key, c]) => `${c.latex} (${key}) = ${c.value}`)
      .join(" \\\\ ");

    const physList = Object.entries(this.physicalConstants)
      .map(([key, c]) => `${c.latex} (${key}) = ${this.formatScientific(c.value)}`)
      .join(" \\\\ ");

    return {
      success: true,
      expression: "list all",
      type: "evaluate",
      result: `${Object.keys(all).length} constants available. Use 'math' or 'physics' to filter.`,
      resultLatex: `\\begin{aligned} \\text{Mathematics:} \\\\ ${mathList} \\\\ \\text{Physics:} \\\\ ${physList} \\end{aligned}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Liste les constantes mathématiques
   */
  private listMathConstants(): ComputationResult {
    this.stepRecorder.add({
      description: "Mathematical constants",
      inputLatex: "Mathematics",
      outputLatex: `${Object.keys(this.mathConstants).length} constants`,
    });

    const list = Object.entries(this.mathConstants)
      .map(([key, c]) => `${c.latex} = ${c.value} \\quad (${c.description})`)
      .join(" \\\\ ");

    return {
      success: true,
      expression: "math constants",
      type: "evaluate",
      result: Object.entries(this.mathConstants).map(([, c]) => `${c.symbol} = ${c.value}`).join(", "),
      resultLatex: `\\begin{aligned} ${list} \\end{aligned}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Liste les constantes physiques
   */
  private listPhysicalConstants(): ComputationResult {
    this.stepRecorder.add({
      description: "Physical constants",
      inputLatex: "Physics",
      outputLatex: `${Object.keys(this.physicalConstants).length} constants`,
    });

    const list = Object.entries(this.physicalConstants)
      .map(([key, c]) => `${c.latex} = ${this.formatScientific(c.value)} \\quad (${c.description})`)
      .join(" \\\\ ");

    return {
      success: true,
      expression: "physics constants",
      type: "evaluate",
      result: Object.entries(this.physicalConstants).map(([, c]) => `${c.symbol} = ${this.formatScientific(c.value)}`).join(", "),
      resultLatex: `\\begin{aligned} ${list} \\end{aligned}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Récupère une constante spécifique
   */
  private getConstant(name: string, parsed: ParsedExpression): ComputationResult {
    const all = { ...this.mathConstants, ...this.physicalConstants };
    const constant = all[name];

    if (!constant) {
      throw new Error(
        `Unknown constant: "${name}". Use 'list' to see all constants, 'math' for mathematical, or 'physics' for physical.`
      );
    }

    this.stepRecorder.add({
      description: constant.description,
      inputLatex: `Constant: ${constant.latex}`,
      outputLatex: `${constant.latex} = ${constant.value >= 0.001 ? constant.value : this.formatScientific(constant.value)}`,
    });

    return {
      success: true,
      expression: parsed.expression,
      type: "evaluate",
      result: `${constant.symbol} = ${constant.value >= 0.001 ? constant.value : this.formatScientific(constant.value)}`,
      resultLatex: `${constant.latex} = ${constant.value >= 0.001 ? constant.value : this.formatScientific(constant.value)} \\text{ (${constant.description})}`,
      steps: this.stepRecorder.getAll(),
      metadata: { duration: 0, stepCount: this.stepRecorder.count, confidence: 1.0 },
    };
  }

  /**
   * Formate un nombre en notation scientifique
   */
  private formatScientific(value: number): string {
    if (value === 0) return "0";
    const exp = Math.floor(Math.log10(Math.abs(value)));
    const mantissa = value / Math.pow(10, exp);
    return `${mantissa.toFixed(6)} \\times 10^{${exp}}`;
  }
}

interface ConstantDefinition {
  value: number;
  symbol: string;
  latex: string;
  description: string;
}
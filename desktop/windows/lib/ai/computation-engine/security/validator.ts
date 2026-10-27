// lib/ai/computation-engine/security/validator.ts

/**
 * Scientia Labs — Computation Engine
 * Validateur : vérifie la sécurité des expressions avant exécution
 */

export class ExpressionValidator {
  private blockedPatterns: RegExp[] = [
    /require\s*\(/i,
    /import\s*\(/i,
    /process\s*\./i,
    /global\s*\./i,
    /__proto__/i,
    /constructor\s*\(/i,
    /Function\s*\(/i,
    /eval\s*\(/i,
    /setTimeout\s*\(/i,
    /setInterval\s*\(/i,
    /fetch\s*\(/i,
    /XMLHttpRequest/i,
    /WebSocket/i,
    /localStorage/i,
    /sessionStorage/i,
    /document\s*\./i,
    /window\s*\./i,
  ];

  /**
   * Valide qu'une expression est sûre à exécuter
   */
  validate(expression: string): ValidationResult {
    // Vérifier la longueur
    if (expression.length === 0) {
      return { valid: false, reason: "Expression is empty" };
    }

    if (expression.length > 2000) {
      return { valid: false, reason: "Expression exceeds 2000 characters" };
    }

    // Vérifier les patterns bloqués
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(expression)) {
        return {
          valid: false,
          reason: `Blocked pattern detected: ${pattern.source}`,
        };
      }
    }

    // Vérifier les caractères non autorisés
    const allowedChars = /^[a-zA-Z0-9\s\+\-\*\/\^\(\)\[\]\{\}\.,;:!=<>|&%\^~'\"`°πe∞∂∫√∑∏∆∇λμνξρσφψωθαβγδεζηικλμνξπρστυφχψω\^\_\@\#\$\\]+$/;
    if (!allowedChars.test(expression)) {
      return { valid: false, reason: "Expression contains invalid characters" };
    }

    return { valid: true };
  }
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}
// lib/ai/computation-engine/core/types.ts

/**
 * Scientia Labs — Computation Engine
 * Types fondamentaux pour le moteur de calcul scientifique
 */

// ─── Type d'opération mathématique ────────────────────────────────

export type ComputationType =
  | "evaluate" // Calcul simple : 2 + 2 * 3
  | "derivative" // Dérivée : d/dx (x²)
  | "integral" // Intégrale : ∫ x² dx
  | "limit" // Limite : lim x→0 sin(x)/x
  | "solve" // Résoudre équation : x² - 4 = 0
  | "system" // Système linéaire : 2x + y = 5
  | "determinant" // Déterminant : det([[1,2],[3,4]])
  | "inverse" // Inverse de matrice
  | "eigenvalues" // Valeurs propres
  | "simplify" // Simplification symbolique
  | "taylor" // Série de Taylor
  | "convert" // Conversion d'unités
  | "stats"; // Statistiques

// ─── Requête entrante (depuis l'IA) ────────────────────────────────

export interface ComputationRequest {
  /** Type d'opération mathématique */
  type: ComputationType;
  /** Expression mathématique en notation standard */
  expression: string;
  /** Variable concernée (pour dérivées, intégrales, etc.) */
  variable?: string;
  /** Paramètres supplémentaires selon le type */
  params?: Record<string, unknown>;
}

// ─── Étape de calcul ────────────────────────────────────────────────

export interface ComputationStep {
  /** Numéro de l'étape (1, 2, 3...) */
  step: number;
  /** Description de ce qui est fait à cette étape */
  description: string;
  /** Expression d'entrée en LaTeX */
  inputLatex: string;
  /** Expression de sortie en LaTeX */
  outputLatex: string;
  /** Règle ou propriété appliquée */
  rule?: string;
}

// ─── Résultat du calcul ────────────────────────────────────────────

export interface ComputationResult {
  /** Le calcul a-t-il réussi ? */
  success: boolean;
  /** L'expression originale */
  expression: string;
  /** Le type d'opération */
  type: ComputationType;
  /** Le résultat final (texte brut) */
  result: string;
  /** Le résultat final en LaTeX */
  resultLatex: string;
  /** Les étapes du calcul */
  steps: ComputationStep[];
  /** Métadonnées */
  metadata: {
    /** Temps d'exécution en ms */
    duration: number;
    /** Nombre d'étapes */
    stepCount: number;
    /** Niveau de confiance (0-1) */
    confidence: number;
  };
  /** Message d'erreur si échec */
  error?: string;
}

// ─── Format de sortie pour l'affichage ─────────────────────────────

export interface FormattedOutput {
  /** Résultat formaté pour affichage inline dans le chat */
  inline: {
    /** Texte court pour la carte compacte */
    summary: string;
    /** Résultat en LaTeX pour la carte compacte */
    latex: string;
  };
  /** Résultat détaillé pour le panneau latéral */
  detailed: {
    /** Titre du calcul */
    title: string;
    /** Expression originale en LaTeX */
    expression: string;
    /** Liste des étapes formatées */
    steps: FormattedStep[];
    /** Résultat final en LaTeX */
    result: string;
  };
}

export interface FormattedStep {
  step: number;
  description: string;
  inputLatex: string;
  outputLatex: string;
  rule?: string;
}

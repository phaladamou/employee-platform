export interface EmployeeLLMMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface EmployeeLLMRequest {
  readonly messages: readonly EmployeeLLMMessage[];
  readonly temperature?: number;
}

export interface EmployeeLLMResponse {
  readonly content: string;
  readonly model: string;
  /**
   * Tokens factures par l'appel, quand le fournisseur les renvoie
   * (API compatible OpenAI : champ `usage`). Absent = non mesure
   * (jamais 0 par defaut : 0 signifierait "gratuit prouve").
   */
  readonly usage?: LLMCallUsage;
}

/** Compteurs d'un appel LLM (champs partiels possibles). */
export interface LLMCallUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

/**
 * Port LLM du runtime Employee : le moteur ne connait que cette
 * interface, jamais un fournisseur concret (injection de dependance).
 */
export interface EmployeeLLMProvider {
  readonly id: string;
  generate(request: EmployeeLLMRequest): Promise<EmployeeLLMResponse>;
  /**
   * Generation avec texte progressif (optionnel) : onToken recoit
   * chaque fragment non vide dans l'ordre (attendu : contre-pression
   * naturelle), la promesse se resout avec la reponse COMPLETE
   * (compteurs d'usage souvent absents en flux). Absent = repli sur
   * generate() : pas de streaming, resultat identique.
   */
  generateStream?(
    request: EmployeeLLMRequest,
    onToken: (text: string) => void | Promise<void>
  ): Promise<EmployeeLLMResponse>;
}

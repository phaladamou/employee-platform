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
}

/**
 * Port LLM du runtime Employee : le moteur ne connait que cette
 * interface, jamais un fournisseur concret (injection de dependance).
 */
export interface EmployeeLLMProvider {
  readonly id: string;
  generate(request: EmployeeLLMRequest): Promise<EmployeeLLMResponse>;
}

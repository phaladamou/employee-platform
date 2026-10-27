import type { CoreInput } from "../../contracts/input";
import type { HostMessage } from "../../contracts/host";

/**
 * Noms des tools disponibles dans le ChatAgent.
 * Utilisé pour experimental_activeTools de Vercel AI SDK.
 */
export type ChatToolName = "webSearch";

/**
 * Contexte interne du ChatAgent.
 * Construit à partir du CoreInput + de l'historique du Host.
 */
export type ChatAgentContext = {
  readonly input: CoreInput;
  readonly history: HostMessage[];
  readonly systemPrompt: string;
  readonly activeTools: ChatToolName[];
};

/**
 * Résultat interne d'un tool exécuté par le ChatAgent.
 */
export type ChatToolExecution = {
  readonly toolName: ChatToolName;
  readonly toolCallId: string;
  readonly input: unknown;
  readonly output: unknown;
};

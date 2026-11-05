import type {
  EmployeeLLMProvider,
  EmployeeLLMRequest,
} from "./llm-provider";

/**
 * Genere un texte de reponse (mode conversationnel) : flux progressif
 * quand le provider sait streamer, sinon un seul appel bloque dont le
 * resultat part en un token (meme texte final, arrive d'un bloc).
 * Sans onToken : simple appel, zero streaming.
 */
export async function generateReplyText(
  provider: EmployeeLLMProvider,
  request: EmployeeLLMRequest,
  onToken?: (text: string) => void | Promise<void>
): Promise<string> {
  if (onToken === undefined) {
    return (await provider.generate(request)).content;
  }
  if (provider.generateStream !== undefined) {
    return (await provider.generateStream(request, onToken)).content;
  }
  const content = (await provider.generate(request)).content;
  await onToken(content);
  return content;
}

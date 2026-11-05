// Parseur pur des lignes de stream OpenAI ("data: {...}" /
// "data: [DONE]"). Zero dependance. Sert le provider streaming
// (FetchLLMProvider.generateStream) : le texte progressif part
// vers l'UI des sa reception, jamais bufferise integral.
export interface StreamLine {
  done: boolean;
  text: string;
}

const IDLE: StreamLine = { done: false, text: "" };
const DONE: StreamLine = { done: true, text: "" };

export function parseOpenAIStreamLine(line: string): StreamLine {
  const trimmed = line.trimEnd();
  if (!trimmed.startsWith("data:")) {
    return IDLE;
  }
  const payload = trimmed.slice("data:".length).trim();
  if (payload === "[DONE]") {
    return DONE;
  }
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    return IDLE;
  }
  if (typeof data !== "object" || data === null) {
    return IDLE;
  }
  if ("error" in data) {
    return DONE;
  }
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return IDLE;
  }
  const delta = (choices[0] as { delta?: unknown }).delta as
    | { content?: unknown }
    | undefined;
  const content = delta?.content;
  if (typeof content !== "string" || !content) {
    return IDLE;
  }
  return { done: false, text: content };
}

/**
 * Transforme un flux SSE OpenAI brut en flux de texte pur : chaque
 * ligne "data:" complete est convertie des sa reception (pas de
 * buffering integral), le flux se termine sur "[DONE]" ou erreur.
 */
export function pipeSSEToText(
  upstream: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  const reader = upstream.getReader();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";
      const pushLine = (line: string): boolean => {
        const parsed = parseOpenAIStreamLine(line);
        if (parsed.text) {
          controller.enqueue(encoder.encode(parsed.text));
        }
        return parsed.done;
      };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (pushLine(line)) {
              controller.close();
              return;
            }
          }
        }
        pushLine(buffer);
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

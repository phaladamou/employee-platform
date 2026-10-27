import { regularPrompt } from "./identity";
import { artifactsPrompt } from "./artifacts";
import { reasoningPrompt } from "./reasoning";

export type ChatPromptOptions = {
  supportsTools: boolean;
  mode?: string | null;
};

export const systemPrompt = ({
  supportsTools,
  mode,
}: ChatPromptOptions): string => {
  if (mode === "reasoning") {
    const basePrompt = supportsTools
      ? `${regularPrompt}\n\n${artifactsPrompt}`
      : regularPrompt;
    return `${reasoningPrompt}\n\n${basePrompt}`;
  }

  if (supportsTools) {
    return `${regularPrompt}\n\n${artifactsPrompt}`;
  }

  return regularPrompt;
};

export { regularPrompt, artifactsPrompt, reasoningPrompt };

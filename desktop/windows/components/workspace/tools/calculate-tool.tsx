// components/workspace/tools/calculate-tool.tsx
"use client";

import { ScientificExecutionTrace } from "@/components/workspace/scientific-execution-trace";

type CalculatePart = {
  toolCallId: string;
  state: string;
  input?: { type?: string; expression?: string; variable?: string };
  output?: {
    expression?: string;
    result?: string;
    resultLatex?: string;
    steps?: Array<{
      step: number;
      description: string;
      input: string;
      output: string;
      rule?: string;
    }>;
    stepCount?: number;
    confidence?: number;
    error?: string;
  };
};

export function CalculateTool({ part }: { part: CalculatePart }) {
  const { state, input } = part;

  if (state === "input-available" || state === "input-streaming") {
    const expression = input?.expression || "";
    return (
      <div className="mb-2 flex w-fit animate-pulse items-center gap-2 rounded-lg border border-blue-200/40 dark:border-blue-500/20 bg-blue-50/30 dark:bg-blue-950/20 px-3 py-1.5 text-xs text-blue-700 dark:text-blue-300">
        <div className="size-2 animate-ping rounded-full bg-blue-500" />
        <span>Computing: {expression}...</span>
      </div>
    );
  }

  if (state === "output-available") {
    const output = part.output;
    if (!output || output.error) {
      return (
        <div className="py-2 text-[13px] text-red-500">
          {output?.error || "Calculation failed"}
        </div>
      );
    }

    const steps = (output.steps || []).map((s) => ({
      description: s.description,
      status: "done" as const,
    }));

    return (
      <ScientificExecutionTrace
        confidence={output.confidence || 100}
        duration={0}
        engineName="Symbolic Mathematics Core v1.0"
        expression={output.expression || input?.expression || ""}
        result={output.result || ""}
        steps={steps}
      />
    );
  }

  if (state === "output-error") {
    return (
      <div className="py-2 text-[13px] text-red-500">
        Calculation failed.
      </div>
    );
  }

  return null;
}
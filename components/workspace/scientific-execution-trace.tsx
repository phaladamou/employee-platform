// components/workspace/scientific-execution-trace.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, FlaskConical } from "lucide-react";
import { useState } from "react";

export type TraceStep = {
  description: string;
  status: "pending" | "running" | "done" | "error";
};

export type ScientificExecutionTraceProps = {
  engineName: string;
  expression: string;
  steps: TraceStep[];
  result: string | null;
  duration: number;
  confidence: number;
};

export function ScientificExecutionTrace({
  engineName,
  expression,
  steps,
  result,
  duration,
  confidence,
}: ScientificExecutionTraceProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const completedSteps = steps.filter((s) => s.status === "done").length;
  const hasResult = result !== null;

  return (
    <div className="my-3 w-full max-w-3xl mx-auto">
      <div className="rounded-xl border border-blue-200/40 dark:border-blue-500/20 bg-blue-50/30 dark:bg-blue-950/20 overflow-hidden">
        {/* Header - toujours visible */}
        <button
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-100/30 dark:hover:bg-blue-900/20 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
        >
          <FlaskConical className="size-4 text-blue-500 dark:text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-blue-700 dark:text-blue-300">
                Scientific Execution Trace
              </span>
              <span className="text-[11px] text-blue-500/50 dark:text-blue-400/50">
                {duration.toFixed(1)} ms
              </span>
            </div>
            {!isExpanded && hasResult && (
              <p className="text-[12px] text-blue-600/70 dark:text-blue-300/70 truncate mt-0.5">
                {result}
              </p>
            )}
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="size-4 text-blue-500/50 dark:text-blue-400/50" />
          </motion.div>
        </button>

        {/* Body - expandable */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              animate={{ height: "auto", opacity: 1 }}
              className="overflow-hidden"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="px-4 pb-4 space-y-2 border-t border-blue-200/20 dark:border-blue-500/10 pt-3">
                {/* Engine */}
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="text-blue-600/50 dark:text-blue-400/50">Engine:</span>
                  <span className="text-blue-700 dark:text-blue-300 font-medium">{engineName}</span>
                </div>

                {/* Expression */}
                <div className="flex items-start gap-2 text-[12px]">
                  <span className="text-blue-600/50 dark:text-blue-400/50 shrink-0">Expression:</span>
                  <code className="text-blue-700 dark:text-blue-300 font-mono">{expression}</code>
                </div>

                {/* Steps */}
                <div className="space-y-0.5 pt-1">
                  {steps.map((step, index) => (
                    <div
                      className="flex items-center gap-2 text-[12px]"
                      key={index}
                    >
                      <span className="shrink-0">
                        {step.status === "running" && (
                          <motion.span
                            animate={{ opacity: [1, 0.3, 1] }}
                            className="text-blue-500"
                            transition={{ duration: 0.8, repeat: Infinity }}
                          >
                            ◌
                          </motion.span>
                        )}
                        {step.status === "done" && (
                          <span className="text-emerald-500">✓</span>
                        )}
                        {step.status === "error" && (
                          <span className="text-red-500">✗</span>
                        )}
                        {step.status === "pending" && (
                          <span className="text-blue-500/30">○</span>
                        )}
                      </span>
                      <span className="text-blue-700/70 dark:text-blue-300/70">
                        {step.description}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Result */}
                {hasResult && (
                  <div className="pt-2 border-t border-blue-200/20 dark:border-blue-500/10">
                    <div className="flex items-center gap-2 text-[13px]">
                      <span className="text-blue-600/50 dark:text-blue-400/50">Result:</span>
                      <span className="text-blue-700 dark:text-blue-300 font-semibold font-mono">
                        {result}
                      </span>
                      <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full ml-auto">
                        {confidence}% confidence
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
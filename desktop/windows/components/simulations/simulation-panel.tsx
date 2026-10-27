// components/simulations/simulation-panel.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleStopIcon, PlayIcon, StarIcon, XIcon } from "lucide-react";
import { useState } from "react";
import type { SimulationState } from "@/lib/simulations/types";
import { SimulationSuggestions } from "./simulation-suggestions";
import { simulations } from "./simulations";

type SimulationPanelProps = {
  simulation: SimulationState;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
};

export function SimulationPanel({
  simulation,
  onClose,
  onToggleFavorite,
}: SimulationPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const SimulationComponent = simulations[simulation.type];

  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
      >
        <motion.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="flex flex-col w-full max-w-2xl h-[85vh] rounded-2xl border border-border/50 bg-card shadow-[var(--shadow-float)] overflow-hidden"
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-foreground">
                {simulation.title}
              </h2>
              <button
                className={`transition-colors ${
                  simulation.isFavorite
                    ? "text-amber-500"
                    : "text-muted-foreground/40 hover:text-muted-foreground"
                }`}
                onClick={() => onToggleFavorite(simulation.id)}
                type="button"
              >
                <StarIcon className="size-3.5" />
              </button>
            </div>
            <button
              className="rounded-md p-1 text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
              onClick={onClose}
              type="button"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center bg-muted/5 p-4 gap-3">
            {SimulationComponent ? (
              <>
                <SimulationComponent isRunning={isRunning} />
                <div className="flex items-center gap-4 mt-2">
                  <button
                    className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-medium transition-all ${
                      isRunning
                        ? "bg-muted-foreground/20 text-muted-foreground"
                        : "bg-foreground text-background hover:opacity-85"
                    }`}
                    onClick={() => setIsRunning(!isRunning)}
                    type="button"
                  >
                    {isRunning ? (
                      <CircleStopIcon className="size-3" />
                    ) : (
                      <PlayIcon className="size-3" />
                    )}
                    {isRunning ? "Stop" : "Run"}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Simulation not available</p>
            )}
          </div>

          <SimulationSuggestions
            category={simulation.category}
            currentId={simulation.id}
            onSelect={() => {}}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

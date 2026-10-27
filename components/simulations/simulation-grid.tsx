// components/simulations/simulation-grid.tsx
"use client";

import { motion } from "framer-motion";
import type { SimulationCard } from "@/lib/simulations/types";

type SimulationGridProps = {
  simulations: SimulationCard[];
  onSelect: (simulation: SimulationCard) => void;
};

export function SimulationGrid({ simulations, onSelect }: SimulationGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
      {simulations.map((sim, index) => (
        <motion.button
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-start gap-2 rounded-xl border border-border/50 bg-card/30 px-4 py-4 text-left transition-all hover:border-border/60 hover:bg-card/50 hover:shadow-sm"
          initial={{ opacity: 0, y: 8 }}
          key={sim.id}
          onClick={() => onSelect(sim)}
          transition={{
            delay: 0.03 * index,
            duration: 0.25,
            ease: [0.22, 1, 0.36, 1],
          }}
          type="button"
        >
          <span className="text-xl">{sim.icon}</span>
          <div>
            <h3 className="text-[13px] font-medium text-foreground">
              {sim.title}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              {sim.description}
            </p>
          </div>
        </motion.button>
      ))}
    </div>
  );
}

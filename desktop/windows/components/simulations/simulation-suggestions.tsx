// components/simulations/simulation-suggestions.tsx
"use client";

import { DEFAULT_SIMULATIONS } from "@/lib/simulations/constants";
import type { SimulationCard } from "@/lib/simulations/types";

type SimulationSuggestionsProps = {
  category: string;
  currentId: string;
  onSelect: (simulation: SimulationCard) => void;
};

export function SimulationSuggestions({
  category,
  currentId,
  onSelect,
}: SimulationSuggestionsProps) {
  const suggestions = (DEFAULT_SIMULATIONS[category] || []).filter(
    (s) => s.id !== currentId
  );

  if (suggestions.length === 0) return null;

  return (
    <div className="border-t border-border/30 px-5 py-3">
      <p className="text-[11px] text-muted-foreground/50 mb-2">Try also</p>
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {suggestions.map((sim) => (
          <button
            className="shrink-0 flex items-center gap-1.5 rounded-full border border-border/40 bg-card/20 px-3 py-1.5 text-[12px] text-muted-foreground transition-all hover:border-border/60 hover:text-foreground hover:bg-card/40"
            key={sim.id}
            onClick={() => onSelect(sim)}
            type="button"
          >
            <span className="text-sm">{sim.icon}</span>
            <span>{sim.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

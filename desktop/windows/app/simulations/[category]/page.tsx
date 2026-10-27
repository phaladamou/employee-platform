// app/simulations/[category]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SimulationGrid } from "@/components/simulations/simulation-grid";
import { SimulationPanel } from "@/components/simulations/simulation-panel";
import { DEFAULT_SIMULATIONS } from "@/lib/simulations/constants";
import type { SimulationCard, SimulationState } from "@/lib/simulations/types";

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const category = params.category as string;
  const [activeSimulation, setActiveSimulation] =
    useState<SimulationState | null>(null);
  const [simulations, setSimulations] = useState<SimulationCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const defaults = DEFAULT_SIMULATIONS[category] || [];
    setSimulations(defaults);
    setLoading(false);
  }, [category]);

  const handleSelect = useCallback(
    (simulation: SimulationCard) => {
      setActiveSimulation({
        id: simulation.id,
        title: simulation.title,
        type: simulation.type,
        category: category as SimulationState["category"],
        parameters: {},
        isFavorite: false,
        isRunning: false,
      });
    },
    [category]
  );

  const handleClose = useCallback(() => {
    setActiveSimulation(null);
  }, []);

  const handleToggleFavorite = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/simulations/${id}/favorite`, {
        method: "POST",
      });
      if (res.ok) {
        const { isFavorite } = await res.json();
        setActiveSimulation((prev) => (prev ? { ...prev, isFavorite } : null));
      }
    } catch {
      // Ignore error
    }
  }, []);

  const handleCategoryChange = useCallback(() => {
    router.push("/simulations");
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <button
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={handleCategoryChange}
            type="button"
          >
            ← Change field
          </button>
          <span className="text-sm font-medium text-foreground capitalize">
            {category.replace("-", " ")}
          </span>
        </div>
        <span className="text-[12px] text-muted-foreground">
          {simulations.length} simulation
          {simulations.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {simulations.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">No simulations yet</p>
              <p className="text-[12px] text-muted-foreground/50 mt-1">
                Coming soon for this category
              </p>
            </div>
          </div>
        ) : (
          <SimulationGrid onSelect={handleSelect} simulations={simulations} />
        )}
      </div>

      {activeSimulation && (
        <SimulationPanel
          onClose={handleClose}
          onToggleFavorite={handleToggleFavorite}
          simulation={activeSimulation}
        />
      )}
    </div>
  );
}

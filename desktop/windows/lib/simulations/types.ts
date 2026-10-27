// lib/simulations/types.ts
export type SimulationCategory =
  | "physics"
  | "chemistry"
  | "biology"
  | "math"
  | "computer-science";

export type SimulationType =
  | "pendulum"
  | "pendulum-physics"
  | "nbody"
  | "waves"
  | "projectile"
  | "wave"
  | "circuit"
  | "chemical-reaction"
  | "population-growth"
  | "orbital"
  | "custom";

export interface SimulationCard {
  id: string;
  title: string;
  type: SimulationType;
  description: string;
  icon: string;
  thumbnail?: string;
}

export interface SimulationParameters {
  [key: string]: number | string | boolean;
}

export interface SimulationState {
  id: string;
  title: string;
  type: SimulationType;
  category: SimulationCategory;
  parameters: SimulationParameters;
  code?: string;
  isFavorite: boolean;
  isRunning: boolean;
}

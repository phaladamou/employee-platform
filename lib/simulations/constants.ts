// lib/simulations/constants.ts
import type { SimulationCard } from "./types";

export const CATEGORIES = [
  {
    id: "physics" as const,
    label: "Physics",
    description: "Mechanics, waves, electromagnetism",
    icon: "⚛️",
  },
  {
    id: "chemistry" as const,
    label: "Chemistry",
    description: "Reactions, equilibrium, kinetics",
    icon: "🧪",
  },
  {
    id: "biology" as const,
    label: "Biology",
    description: "Population, ecosystems, genetics",
    icon: "🧬",
  },
  {
    id: "math" as const,
    label: "Mathematics",
    description: "Functions, geometry, probability",
    icon: "📐",
  },
  {
    id: "computer-science" as const,
    label: "Computer Science",
    description: "Algorithms, data structures, AI",
    icon: "💻",
  },
];

export const DEFAULT_SIMULATIONS: Record<string, SimulationCard[]> = {
  physics: [
    {
      id: "pendulum-physics",
      title: "Simple Pendulum",
      type: "pendulum-physics",
      description:
        "Oscillation, période, gravité — ajustez les paramètres en temps réel",
      icon: "⏳",
    },
    {
      id: "nbody",
      title: "N-Body Gravitation",
      type: "nbody",
      description:
        "Simulez la gravité entre corps massifs — orbites, collisions, chaos",
      icon: "🌌",
    },
    {
      id: "waves",
      title: "Wave Interference",
      type: "waves",
      description:
        "Ondes 2D, interférences, diffraction — cliquez pour perturber le champ",
      icon: "🌊",
    },
  ],
  chemistry: [
    {
      id: "chemical-reaction",
      title: "Chemical Reaction",
      type: "chemical-reaction",
      description: "Simulate reaction rates and equilibrium",
      icon: "⚗️",
    },
  ],
  biology: [
    {
      id: "population-growth",
      title: "Population Growth",
      type: "population-growth",
      description: "Model exponential and logistic population growth",
      icon: "📈",
    },
  ],
  math: [],
  "computer-science": [],
};

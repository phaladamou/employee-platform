// components/simulations/simulations/index.ts
import { SolarSystem } from "./physics/nbody";
import { Pendulum } from "./physics/pendulum";
import { Waves } from "./physics/waves";

export type SimulationCanvasProps = {
  isRunning: boolean;
};

export const simulations: Record<
  string,
  React.ComponentType<SimulationCanvasProps>
> = {
  "pendulum-physics": Pendulum,
  nbody: SolarSystem,
  waves: Waves,
};

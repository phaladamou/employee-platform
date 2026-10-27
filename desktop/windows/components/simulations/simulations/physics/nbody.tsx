// components/simulations/simulations/physics/nbody.tsx
// Solar System Simulation
"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanetDef {
  name: string;
  a: number;
  period: number;
  r: number;
  tilt: number;
  rotPeriod: number;
  base: string;
  hi: string;
  dk: string;
}

interface PlanetState {
  angle: number;
  selfAngle: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 680;
const H = 480;
const CX = W / 2;
const CY = H / 2 + 10;

const PLANETS: PlanetDef[] = [
  {
    name: "Mercury",
    a: 52,
    period: 0.241,
    r: 3,
    tilt: 0.03,
    rotPeriod: 58.6,
    base: "#9e9e9e",
    hi: "#d0d0d0",
    dk: "#484848",
  },
  {
    name: "Venus",
    a: 76,
    period: 0.615,
    r: 5.5,
    tilt: 0.04,
    rotPeriod: -243,
    base: "#d4a84b",
    hi: "#f5d98a",
    dk: "#8a6010",
  },
  {
    name: "Earth",
    a: 104,
    period: 1.0,
    r: 5.8,
    tilt: 0.41,
    rotPeriod: 1,
    base: "#3d7abf",
    hi: "#8fbfee",
    dk: "#15305a",
  },
  {
    name: "Mars",
    a: 135,
    period: 1.881,
    r: 4,
    tilt: 0.44,
    rotPeriod: 1.03,
    base: "#b5431a",
    hi: "#e07050",
    dk: "#601000",
  },
  {
    name: "Jupiter",
    a: 186,
    period: 11.86,
    r: 15,
    tilt: 0.05,
    rotPeriod: 0.41,
    base: "#c4a46e",
    hi: "#e8d0a0",
    dk: "#6a4818",
  },
  {
    name: "Saturn",
    a: 238,
    period: 29.46,
    r: 12,
    tilt: 0.47,
    rotPeriod: 0.45,
    base: "#d4bc72",
    hi: "#f0dfa0",
    dk: "#806820",
  },
  {
    name: "Uranus",
    a: 285,
    period: 84,
    r: 8,
    tilt: 1.71,
    rotPeriod: -0.72,
    base: "#7fc8ce",
    hi: "#b8eaee",
    dk: "#2a7880",
  },
  {
    name: "Neptune",
    a: 328,
    period: 165,
    r: 7.5,
    tilt: 0.49,
    rotPeriod: 0.67,
    base: "#3a52c0",
    hi: "#7088e8",
    dk: "#101840",
  },
];

const STAR_COUNT = 200;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStars(w: number, h: number) {
  return Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r:
      Math.random() < 0.06
        ? Math.random() * 1.0 + 0.4
        : Math.random() * 0.5 + 0.1,
    a: Math.random() * 0.55 + 0.1,
  }));
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: Array<{ x: number; y: number; r: number; a: number }>
): void {
  for (const s of stars) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${s.a})`;
    ctx.fill();
  }
}

function drawSun(ctx: CanvasRenderingContext2D): void {
  const corona = ctx.createRadialGradient(CX, CY, 16, CX, CY, 52);
  corona.addColorStop(0, "rgba(245,195,55,0.14)");
  corona.addColorStop(0.6, "rgba(245,150,20,0.05)");
  corona.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.arc(CX, CY, 52, 0, Math.PI * 2);
  ctx.fillStyle = corona;
  ctx.fill();

  const sphere = ctx.createRadialGradient(CX - 6, CY - 7, 1, CX, CY, 20);
  sphere.addColorStop(0, "#fff9c0");
  sphere.addColorStop(0.35, "#f8d040");
  sphere.addColorStop(0.75, "#e88010");
  sphere.addColorStop(1, "#b05000");
  ctx.beginPath();
  ctx.arc(CX, CY, 20, 0, Math.PI * 2);
  ctx.fillStyle = sphere;
  ctx.fill();
}

function drawOrbit(ctx: CanvasRenderingContext2D, a: number): void {
  ctx.beginPath();
  ctx.ellipse(CX, CY, a, a * 0.98, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawPlanet(
  ctx: CanvasRenderingContext2D,
  p: PlanetDef,
  s: PlanetState,
  showLabels: boolean
): void {
  const px = CX + Math.cos(s.angle) * p.a;
  const py = CY + Math.sin(s.angle) * p.a * 0.98;

  // Saturn rings
  if (p.name === "Saturn") {
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1, 0.3);
    for (let i = 0; i < 3; i++) {
      const ri = p.r * (1.62 + i * 0.38);
      const ro = ri + p.r * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, ro, 0, Math.PI * 2);
      ctx.arc(0, 0, ri, Math.PI * 2, 0, true);
      ctx.fillStyle = `rgba(210,185,120,${0.26 - i * 0.06})`;
      ctx.fill();
    }
    ctx.restore();
  }

  const sphere = ctx.createRadialGradient(
    px - p.r * 0.32,
    py - p.r * 0.32,
    p.r * 0.04,
    px,
    py,
    p.r
  );
  sphere.addColorStop(0, p.hi);
  sphere.addColorStop(0.45, p.base);
  sphere.addColorStop(1, p.dk);

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(s.selfAngle);

  if (p.name === "Earth") {
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fillStyle = sphere;
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(i * 1.8 + 0.3) * p.r * 0.55,
        Math.sin(i * 1.8 + 0.3) * p.r * 0.45,
        p.r * 0.22,
        p.r * 0.18,
        i * 0.9,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = "rgba(40,140,60,0.50)";
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(120,190,255,0.15)";
    ctx.lineWidth = 1.8;
    ctx.stroke();
  } else if (p.name === "Jupiter") {
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fillStyle = sphere;
    ctx.fill();
    for (const by of [0.4, -0.2, 0.65, -0.55]) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "rgba(100,60,20,0.25)";
      ctx.fillRect(-p.r, by * p.r - p.r * 0.1, p.r * 2, p.r * 0.12);
      ctx.restore();
    }
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fillStyle = sphere;
    ctx.fill();
  }

  ctx.restore();

  if (showLabels) {
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = `${p.base}99`;
    ctx.fillText(p.name, px, py + p.r + 13);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SolarSystem({ isRunning }: { isRunning: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<PlanetState[]>(
    PLANETS.map((_, i) => ({
      angle: (i / PLANETS.length) * Math.PI * 2,
      selfAngle: Math.random() * Math.PI * 2,
    }))
  );
  const starsRef = useRef<
    Array<{ x: number; y: number; r: number; a: number }>
  >([]);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number | null>(null);

  const [speed, setSpeed] = useState(1);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  const speedRef = useRef(speed);
  const showOrbitsRef = useRef(showOrbits);
  const showLabelsRef = useRef(showLabels);
  const isRunningRef = useRef(isRunning);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    showOrbitsRef.current = showOrbits;
  }, [showOrbits]);
  useEffect(() => {
    showLabelsRef.current = showLabels;
  }, [showLabels]);
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    if (starsRef.current.length === 0) {
      starsRef.current = makeStars(W, H);
    }

    function tick(ts: number) {
      const dt = lastRef.current
        ? Math.min((ts - lastRef.current) / 1000, 0.05)
        : 0.016;
      lastRef.current = ts;

      ctx!.fillStyle = "#040710";
      ctx!.fillRect(0, 0, W, H);

      drawStars(ctx!, starsRef.current);
      if (showOrbitsRef.current) PLANETS.forEach((p) => drawOrbit(ctx!, p.a));
      drawSun(ctx!);

      const s = speedRef.current;
      const running = isRunningRef.current;

      PLANETS.forEach((planet, i) => {
        if (running) {
          const orbitalRate = (2 * Math.PI) / (planet.period * 60);
          const rotDir = planet.rotPeriod < 0 ? -1 : 1;
          const rotRate = (2 * Math.PI) / (Math.abs(planet.rotPeriod) * 1.2);
          stateRef.current[i].angle += orbitalRate * s * dt * 60;
          stateRef.current[i].selfAngle += rotRate * s * dt * 60 * rotDir;
        }
        drawPlanet(ctx!, planet, stateRef.current[i], showLabelsRef.current);
      });

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <canvas
        ref={canvasRef}
        style={{
          width: W,
          height: H,
          maxWidth: "100%",
          display: "block",
          borderRadius: 12,
        }}
      />
      <div className="flex items-center gap-5 text-[12px] text-muted-foreground flex-wrap justify-center">
        <label className="flex items-center gap-2">
          <span className="uppercase tracking-widest text-[10px] opacity-50">
            Speed
          </span>
          <input
            className="w-20"
            max={8}
            min={0.1}
            onChange={(e) => setSpeed(Number(e.target.value))}
            step={0.1}
            type="range"
            value={speed}
          />
          <span className="tabular-nums w-8">{speed.toFixed(1)}×</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            checked={showOrbits}
            onChange={(e) => setShowOrbits(e.target.checked)}
            type="checkbox"
          />
          <span>Orbits</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
            type="checkbox"
          />
          <span>Labels</span>
        </label>
      </div>
    </div>
  );
}

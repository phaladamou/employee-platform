// components/simulations/simulations/physics/pendulum.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PhysicsState {
  theta: number;
  omega: number;
}

interface SimConfig {
  L: number;
  g: number;
  b: number;
  theta0: number;
  speed: number;
}

// ─── Intégrateur RK4 ──────────────────────────────────────────────────────────

function rk4Step(
  { theta, omega }: PhysicsState,
  dt: number,
  g: number,
  L: number,
  b: number
): PhysicsState {
  const deriv = (th: number, om: number) => ({
    dTheta: om,
    dOmega: -(g / L) * Math.sin(th) - b * om,
  });

  const k1 = deriv(theta, omega);
  const k2 = deriv(theta + 0.5 * dt * k1.dTheta, omega + 0.5 * dt * k1.dOmega);
  const k3 = deriv(theta + 0.5 * dt * k2.dTheta, omega + 0.5 * dt * k2.dOmega);
  const k4 = deriv(theta + dt * k3.dTheta, omega + dt * k3.dOmega);

  return {
    theta:
      theta +
      (dt / 6) * (k1.dTheta + 2 * k2.dTheta + 2 * k3.dTheta + k4.dTheta),
    omega:
      omega +
      (dt / 6) * (k1.dOmega + 2 * k2.dOmega + 2 * k3.dOmega + k4.dOmega),
  };
}

// ─── Observables physiques ─────────────────────────────────────────────────────

const computePeriod = (L: number, g: number) => 2 * Math.PI * Math.sqrt(L / g);
const computeAlpha = (
  theta: number,
  omega: number,
  g: number,
  L: number,
  b: number
) => -(g / L) * Math.sin(theta) - b * omega;

// ─── Constantes de rendu ──────────────────────────────────────────────────────

const PIVOT_Y = 52;
const BOB_R = 14;
const MAX_TRAIL = 600;
const MAX_PHASE = 2000;

// ─── Composant principal ──────────────────────────────────────────────────────

export function Pendulum({ isRunning }: { isRunning: boolean }) {
  const mainCvs = useRef<HTMLCanvasElement>(null);
  const phaseCvs = useRef<HTMLCanvasElement>(null);
  const hudEls = useRef<Record<string, HTMLSpanElement>>({});

  const stateRef = useRef<PhysicsState>({ theta: Math.PI / 3, omega: 0 });
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const phaseRef = useRef<[number, number][]>([]);
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number | null>(null);
  const cfgRef = useRef<SimConfig>({
    L: 160,
    g: 9.81,
    b: 0.05,
    theta0: Math.PI / 3,
    speed: 1,
  });

  const [cfg, setCfg] = useState<SimConfig>(cfgRef.current);
  const [showTrail, setShowTrail] = useState(true);

  useEffect(() => {
    cfgRef.current = cfg;
  }, [cfg]);

  const patchCfg = useCallback(
    (key: keyof SimConfig, value: number, doReset = false) => {
      setCfg((prev) => ({ ...prev, [key]: value }));
      if (doReset) {
        stateRef.current = { theta: cfgRef.current.theta0, omega: 0 };
        trailRef.current = [];
        phaseRef.current = [];
        lastTsRef.current = null;
      }
    },
    []
  );

  const resetSim = useCallback(() => {
    stateRef.current = { theta: cfgRef.current.theta0, omega: 0 };
    trailRef.current = [];
    phaseRef.current = [];
    lastTsRef.current = null;
  }, []);

  // ── Boucle de rendu ─────────────────────────────────────────────────────────

  useEffect(() => {
    const mCvs = mainCvs.current;
    const pCvs = phaseCvs.current;
    if (!mCvs || !pCvs) return;

    const mCtx = mCvs.getContext("2d");
    const pCtx = pCvs.getContext("2d");
    if (!mCtx || !pCtx) return;

    const dpr = window.devicePixelRatio || 1;

    const scaleCanvas = (
      cvs: HTMLCanvasElement,
      ctx: CanvasRenderingContext2D
    ) => {
      const r = cvs.getBoundingClientRect();
      cvs.width = r.width * dpr;
      cvs.height = r.height * dpr;
      ctx.scale(dpr, dpr);
      return { w: r.width, h: r.height };
    };

    let MW = 0,
      MH = 0,
      PW = 0,
      PH = 0;

    function resize() {
      const m = scaleCanvas(mCvs!, mCtx!);
      const p = scaleCanvas(pCvs!, pCtx!);
      MW = m.w;
      MH = m.h;
      PW = p.w;
      PH = p.h;
    }
    resize();
    window.addEventListener("resize", resize);

    const MCX = () => MW / 2;

    // ── Rendu canvas principal ────────────────────────────────────────────────

    const drawMain = (
      bx: number,
      by: number,
      s: PhysicsState,
      c: SimConfig
    ) => {
      const cx = MCX();
      const ctx = mCtx!;
      ctx.clearRect(0, 0, MW, MH);

      // Grille
      ctx.save();
      ctx.strokeStyle = "rgba(128,128,128,0.06)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < MW; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, MH);
        ctx.stroke();
      }
      for (let y = 0; y < MH; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(MW, y);
        ctx.stroke();
      }
      ctx.restore();

      // Arc de rotation
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = "rgba(128,128,128,0.18)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(cx, PIVOT_Y, c.L, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Trail
      if (showTrail && trailRef.current.length > 1) {
        const trail = trailRef.current;
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 1; i < trail.length; i++) {
          const a = i / trail.length;
          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
          ctx.lineTo(trail[i].x, trail[i].y);
          ctx.globalAlpha = 0.08 + a * 0.55;
          ctx.strokeStyle = `hsl(${210 + a * 30}, 80%, 58%)`;
          ctx.lineWidth = 0.8 + a * 2.2;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // Tige
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, PIVOT_Y);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = "rgba(140,140,140,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Pivot
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, PIVOT_Y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(90,90,90,0.75)";
      ctx.fill();
      ctx.restore();

      // Bob
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, BOB_R + 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(55,138,221,0.10)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx, by, BOB_R, 0, Math.PI * 2);
      ctx.fillStyle = "#378ADD";
      ctx.fill();
      ctx.strokeStyle = "rgba(55,138,221,0.40)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(
        bx - BOB_R * 0.32,
        by - BOB_R * 0.32,
        BOB_R * 0.28,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.fill();
      ctx.restore();

      // Vecteur vitesse
      const vMag = s.omega * c.L * 0.28;
      if (Math.abs(vMag) > 2) {
        const va = s.theta + (Math.PI / 2) * Math.sign(s.omega);
        const vx = bx + Math.sin(va) * vMag;
        const vy = by + Math.cos(va) * vMag;
        const hLen = 7;
        const hAng = Math.atan2(vy - by, vx - bx);
        ctx.save();
        ctx.strokeStyle = "rgba(213,90,48,0.80)";
        ctx.fillStyle = "rgba(213,90,48,0.80)";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(vx, vy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        ctx.lineTo(
          vx - hLen * Math.cos(hAng - 0.45),
          vy - hLen * Math.sin(hAng - 0.45)
        );
        ctx.lineTo(
          vx - hLen * Math.cos(hAng + 0.45),
          vy - hLen * Math.sin(hAng + 0.45)
        );
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    };

    // ── Portrait de phase ─────────────────────────────────────────────────────

    const drawPhase = () => {
      const pts = phaseRef.current;
      const ctx = pCtx!;
      ctx.clearRect(0, 0, PW, PH);

      ctx.save();
      ctx.strokeStyle = "rgba(128,128,128,0.12)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(PW / 2, 0);
      ctx.lineTo(PW / 2, PH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, PH / 2);
      ctx.lineTo(PW, PH / 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "rgba(128,128,128,0.5)";
      ctx.fillText("θ →", PW - 18, PH / 2 - 3);
      ctx.fillText("↑ ω", PW / 2 + 3, 11);
      ctx.restore();

      if (pts.length < 2) return;

      const thR = Math.PI * 1.2;
      const omR = Math.max(...pts.map((p) => Math.abs(p[1]))) * 1.2 || 3;

      ctx.save();
      ctx.lineCap = "round";
      for (let i = 1; i < pts.length; i++) {
        const a = i / pts.length;
        const x1 = PW / 2 + (pts[i - 1][0] / thR) * (PW / 2 - 8);
        const y1 = PH / 2 - (pts[i - 1][1] / omR) * (PH / 2 - 8);
        const x2 = PW / 2 + (pts[i][0] / thR) * (PW / 2 - 8);
        const y2 = PH / 2 - (pts[i][1] / omR) * (PH / 2 - 8);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.globalAlpha = 0.15 + a * 0.85;
        ctx.strokeStyle = `hsl(${260 - a * 80}, 75%, 58%)`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      const last = pts[pts.length - 1];
      const lpx = PW / 2 + (last[0] / thR) * (PW / 2 - 8);
      const lpy = PH / 2 - (last[1] / omR) * (PH / 2 - 8);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(lpx, lpy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#378ADD";
      ctx.fill();
      ctx.restore();
    };

    // ── Boucle principale ─────────────────────────────────────────────────────

    let frameCount = 0;

    const animate = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const wallDt = Math.min((ts - lastTsRef.current) / 1000, 0.05);
      lastTsRef.current = ts;

      const c = cfgRef.current;
      let s = stateRef.current;

      if (isRunning) {
        const steps = c.speed;
        const dt = wallDt / steps;
        for (let i = 0; i < steps; i++) {
          s = rk4Step(s, dt, c.g, c.L, c.b);
        }
        stateRef.current = s;

        const bx = MCX() + c.L * Math.sin(s.theta);
        const by = PIVOT_Y + c.L * Math.cos(s.theta);
        trailRef.current.push({ x: bx, y: by });
        if (trailRef.current.length > MAX_TRAIL) trailRef.current.shift();
        phaseRef.current.push([s.theta, s.omega]);
        if (phaseRef.current.length > MAX_PHASE) phaseRef.current.shift();
      }

      const bx = MCX() + c.L * Math.sin(s.theta);
      const by = PIVOT_Y + c.L * Math.cos(s.theta);

      drawMain(bx, by, s, c);
      drawPhase();

      frameCount++;
      if (frameCount % 3 === 0) {
        const els = hudEls.current;
        if (els.theta)
          els.theta.textContent = `${((s.theta * 180) / Math.PI).toFixed(1)}°`;
        if (els.omega) els.omega.textContent = `${s.omega.toFixed(2)} r/s`;
        if (els.alpha)
          els.alpha.textContent = `${computeAlpha(s.theta, s.omega, c.g, c.L, c.b).toFixed(2)} r/s²`;
        if (els.ek)
          els.ek.textContent = `${((0.5 * s.omega * s.omega * c.L * c.L) / 10_000).toFixed(3)} J`;
        if (els.ep)
          els.ep.textContent = `${((c.g * c.L * (1 - Math.cos(s.theta))) / 1000).toFixed(3)} J`;
        if (els.period)
          els.period.textContent = `${computePeriod(c.L, c.g).toFixed(2)} s`;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [isRunning, showTrail]);

  // ── UI ─────────────────────────────────────────────────────────────────────

  const sliders: {
    label: string;
    key: keyof SimConfig;
    min: number;
    max: number;
    step: number;
    fmt: (v: number) => string;
    rawToVal?: (v: number) => number;
    valToRaw?: (v: number) => number;
    reset?: boolean;
  }[] = [
    {
      label: "Longueur L",
      key: "L",
      min: 40,
      max: 250,
      step: 1,
      fmt: (v) => `${v} px`,
      reset: true,
    },
    {
      label: "Gravité g",
      key: "g",
      min: 1,
      max: 30,
      step: 0.1,
      fmt: (v) => `${v.toFixed(1)} m/s²`,
    },
    {
      label: "Amor. b",
      key: "b",
      min: 0,
      max: 2,
      step: 0.01,
      fmt: (v) => v.toFixed(2),
    },
    {
      label: "Angle θ₀",
      key: "theta0",
      min: 5,
      max: 175,
      step: 1,
      rawToVal: (v) => (v * Math.PI) / 180,
      valToRaw: (v) => Math.round((v * 180) / Math.PI),
      fmt: (v) => `${Math.round((v * 180) / Math.PI)}°`,
      reset: true,
    },
    {
      label: "Vitesse ×",
      key: "speed",
      min: 1,
      max: 20,
      step: 1,
      fmt: (v) => `×${v}`,
    },
  ];

  return (
    <div className="flex flex-col gap-3 w-full font-sans">
      {/* Canvases */}
      <div className="grid grid-cols-[1fr_220px] gap-2 w-full">
        <canvas
          className="rounded-xl border border-border/20 bg-muted/10"
          height={340}
          ref={mainCvs}
          style={{ display: "block", width: "100%", height: 340 }}
        />
        <div className="flex flex-col rounded-xl border border-border/20 bg-muted/10 overflow-hidden">
          <div className="text-[11px] text-muted-foreground px-2.5 py-1.5 border-b border-border/20">
            Portrait de phase{" "}
            <span className="font-medium text-foreground tabular-nums">
              θ vs ω
            </span>
          </div>
          <canvas
            className="rounded-b-xl"
            ref={phaseCvs}
            style={{ display: "block", flex: 1, width: "100%" }}
          />
        </div>
      </div>

      {/* Équations */}
      <div className="rounded-xl border border-border/20 bg-muted/5 px-4 py-2.5 text-[13px] space-y-0.5">
        {[
          ["dθ/dt", "= ω", "omega"],
          ["dω/dt", "= −(g/L)·sin θ − b·ω", "alpha"],
          ["T", "= 2π·√(L/g)", "period"],
        ].map(([lhs, rhs, refKey]) => (
          <div className="flex items-baseline gap-2 leading-8" key={lhs}>
            <span className="italic font-medium text-foreground w-12">
              {lhs}
            </span>
            <span className="text-muted-foreground">{rhs}</span>
            <span
              className="ml-auto text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 tabular-nums whitespace-nowrap"
              ref={(el) => {
                if (el) hudEls.current[refKey] = el;
              }}
            />
          </div>
        ))}
      </div>

      {/* HUD */}
      <div className="flex flex-wrap gap-1.5">
        {[
          ["θ", "theta"],
          ["ω", "omega"],
          ["α", "alpha"],
          ["Ek", "ek"],
          ["Ep", "ep"],
        ].map(([label, refKey]) => (
          <div
            className="text-[11px] px-2.5 py-1 rounded-lg border border-border/20 bg-background tabular-nums"
            key={label}
          >
            <span className="text-muted-foreground mr-1.5">{label}</span>
            <span
              className="font-medium"
              ref={(el) => {
                if (el) hudEls.current[refKey] = el;
              }}
            />
          </div>
        ))}
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] text-muted-foreground">
        {sliders.map(
          ({ label, key, min, max, step, fmt, rawToVal, valToRaw, reset }) => {
            const raw = valToRaw
              ? valToRaw(cfg[key] as number)
              : (cfg[key] as number);
            return (
              <label className="flex items-center gap-2" key={key}>
                <span className="w-16 shrink-0">{label}</span>
                <input
                  className="flex-1"
                  max={max}
                  min={min}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    patchCfg(key, rawToVal ? rawToVal(r) : r, reset);
                  }}
                  step={step}
                  type="range"
                  value={raw}
                />
                <span className="w-18 text-right font-medium text-foreground tabular-nums">
                  {fmt(cfg[key] as number)}
                </span>
              </label>
            );
          }
        )}
      </div>

      {/* Boutons */}
      <div className="flex flex-wrap gap-2">
        <button
          className="text-[12px] px-3 py-1 rounded-lg border border-border/30 bg-muted/20 hover:bg-muted/40 transition-colors"
          onClick={() => setShowTrail((v) => !v)}
          type="button"
        >
          Trajectoire: {showTrail ? "on" : "off"}
        </button>
        <button
          className="text-[12px] px-3 py-1 rounded-lg border border-border/30 bg-muted/20 hover:bg-muted/40 transition-colors"
          onClick={resetSim}
          type="button"
        >
          Reset
        </button>
        <button
          className="text-[12px] px-3 py-1 rounded-lg border border-border/30 bg-muted/20 hover:bg-muted/40 transition-colors"
          onClick={() => {
            phaseRef.current = [];
          }}
          type="button"
        >
          Effacer phase
        </button>
      </div>
    </div>
  );
}

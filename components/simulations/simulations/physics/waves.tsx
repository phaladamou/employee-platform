// components/simulations/simulations/physics/waves.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SIZE = 220;
const DAMPING = 0.97;
const MAX_SOURCES = 5;

interface Source {
  x: number;
  y: number;
  id: number;
}

export function Waves({ isRunning }: { isRunning: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const curRef = useRef<Float32Array>(new Float32Array(SIZE * SIZE));
  const prevRef = useRef<Float32Array>(new Float32Array(SIZE * SIZE));
  const animFrameRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1, y: -1, down: false });
  const tRef = useRef(0);

  const [frequency, setFrequency] = useState(3);
  const [amplitude, setAmplitude] = useState(0.7);
  const [damping, setDamping] = useState(DAMPING);
  const [speedExp, setSpeedExp] = useState(0);
  const [sources, setSources] = useState<Source[]>([
    { x: Math.floor(SIZE / 2), y: Math.floor(SIZE / 2), id: 0 },
  ]);
  const [colorMode, setColorMode] = useState<"ocean" | "thermal" | "plasma">(
    "ocean"
  );
  const [showGrid, setShowGrid] = useState(false);

  const sourcesRef = useRef(sources);
  const freqRef = useRef(frequency);
  const ampRef = useRef(amplitude);
  const dampRef = useRef(damping);
  const speedRef = useRef(10 ** speedExp);
  const colorRef = useRef(colorMode);
  const showGridRef = useRef(showGrid);

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);
  useEffect(() => {
    freqRef.current = frequency;
  }, [frequency]);
  useEffect(() => {
    ampRef.current = amplitude;
  }, [amplitude]);
  useEffect(() => {
    dampRef.current = damping;
  }, [damping]);
  useEffect(() => {
    speedRef.current = 10 ** speedExp;
  }, [speedExp]);
  useEffect(() => {
    colorRef.current = colorMode;
  }, [colorMode]);
  useEffect(() => {
    showGridRef.current = showGrid;
  }, [showGrid]);

  const reset = useCallback(() => {
    curRef.current.fill(0);
    prevRef.current.fill(0);
    tRef.current = 0;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const imgData = ctx.createImageData(W, H);
    const px = imgData.data;

    function colorize(val: number, out: Uint8ClampedArray, offset: number) {
      const v = Math.max(-1, Math.min(1, val));
      const mode = colorRef.current;

      if (mode === "ocean") {
        const pos = Math.max(0, v);
        const neg = Math.max(0, -v);
        out[offset] = Math.floor(neg * 220 + pos * 20);
        out[offset + 1] = Math.floor(Math.abs(v) * 60);
        out[offset + 2] = Math.floor(pos * 255 + neg * 40);
        out[offset + 3] = 255;
      } else if (mode === "thermal") {
        const t = Math.abs(v);
        out[offset] = Math.min(255, Math.floor(t * 3 * 255));
        out[offset + 1] = Math.min(
          255,
          Math.floor(Math.max(0, t * 3 - 1) * 255)
        );
        out[offset + 2] = Math.min(
          255,
          Math.floor(Math.max(0, t * 3 - 2) * 255)
        );
        out[offset + 3] = 255;
      } else {
        const a = Math.abs(v);
        out[offset] = Math.floor(128 + 127 * Math.sin(a * Math.PI * 2));
        out[offset + 1] = Math.floor(
          128 + 127 * Math.sin(a * Math.PI * 2 + 2.094)
        );
        out[offset + 2] = Math.floor(
          128 + 127 * Math.sin(a * Math.PI * 2 + 4.189)
        );
        out[offset + 3] = 255;
      }
    }

    function draw() {
      if (!ctx) return;
      const cur = curRef.current;
      const scaleX = W / SIZE;
      const scaleY = H / SIZE;

      for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
          const val = cur[row * SIZE + col];
          const px0 = Math.floor(col * scaleX);
          const py0 = Math.floor(row * scaleY);
          const pw = Math.ceil(scaleX);
          const ph = Math.ceil(scaleY);

          for (let dy = 0; dy < ph; dy++) {
            const gy = py0 + dy;
            if (gy >= H) continue;
            for (let dx = 0; dx < pw; dx++) {
              const gx = px0 + dx;
              if (gx >= W) continue;
              colorize(val, px, (gy * W + gx) * 4);
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);

      if (showGridRef.current) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 0.5;
        const step = Math.max(1, Math.floor(SIZE / 20));
        for (let i = 0; i <= SIZE; i += step) {
          ctx.beginPath();
          ctx.moveTo(i * scaleX, 0);
          ctx.lineTo(i * scaleX, H);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i * scaleY);
          ctx.lineTo(W, i * scaleY);
          ctx.stroke();
        }
        ctx.restore();
      }

      const srcs = sourcesRef.current;
      srcs.forEach((src) => {
        const sx = src.x * scaleX;
        const sy = src.y * scaleY;
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.fill();
        ctx.restore();
      });
    }

    function step() {
      const speed = speedRef.current;
      const substeps = Math.max(1, Math.round(speed));
      const dt = speed / substeps;

      for (let s = 0; s < substeps; s++) {
        tRef.current += dt * 0.016;
        const t = tRef.current;
        const cur = curRef.current;
        const prv = prevRef.current;
        const d = dampRef.current;
        const freq = freqRef.current;
        const amp = ampRef.current;

        sourcesRef.current.forEach((src) => {
          cur[src.y * SIZE + src.x] = Math.sin(t * freq * 2 * Math.PI) * amp;
        });

        const m = mouseRef.current;
        if (m.down && m.x >= 0) {
          const mx = Math.floor((m.x / W) * SIZE);
          const my = Math.floor((m.y / H) * SIZE);
          if (mx > 0 && mx < SIZE - 1 && my > 0 && my < SIZE - 1) {
            cur[my * SIZE + mx] = Math.sin(t * freq * 2 * Math.PI) * amp;
          }
        }

        const next = prv;
        const c2 = 0.25;

        for (let row = 1; row < SIZE - 1; row++) {
          for (let col = 1; col < SIZE - 1; col++) {
            const idx = row * SIZE + col;
            const lap =
              cur[idx - SIZE] +
              cur[idx + SIZE] +
              cur[idx - 1] +
              cur[idx + 1] -
              4 * cur[idx];
            next[idx] = (2 * cur[idx] - prv[idx] + c2 * lap) * d;
          }
        }

        for (let i = 0; i < SIZE; i++) {
          next[i] = 0;
          next[(SIZE - 1) * SIZE + i] = 0;
          next[i * SIZE] = 0;
          next[i * SIZE + SIZE - 1] = 0;
        }

        prevRef.current = curRef.current;
        curRef.current = next;
      }
    }

    function animate() {
      if (isRunning) step();
      draw();
      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isRunning, colorMode]);

  function addSource(e: React.MouseEvent) {
    if (e.detail !== 2) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * SIZE);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * SIZE);
    setSources((prev) =>
      prev.length >= MAX_SOURCES ? prev : [...prev, { x, y, id: Date.now() }]
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <div
        className="relative w-full rounded-xl border border-border/20 overflow-hidden bg-black"
        style={{ height: 360 }}
      >
        <canvas
          className="absolute inset-0 w-full h-full cursor-crosshair"
          onMouseDown={(e) => {
            mouseRef.current = {
              x:
                e.clientX -
                (canvasRef.current?.getBoundingClientRect().left ?? 0),
              y:
                e.clientY -
                (canvasRef.current?.getBoundingClientRect().top ?? 0),
              down: true,
            };
            addSource(e);
          }}
          onMouseLeave={() => {
            mouseRef.current.down = false;
          }}
          onMouseMove={(e) => {
            if (mouseRef.current.down) {
              mouseRef.current.x =
                e.clientX -
                (canvasRef.current?.getBoundingClientRect().left ?? 0);
              mouseRef.current.y =
                e.clientY -
                (canvasRef.current?.getBoundingClientRect().top ?? 0);
            }
          }}
          onMouseUp={() => {
            mouseRef.current.down = false;
          }}
          ref={canvasRef}
          style={{ height: 360 }}
        />
      </div>
      <p className="text-[12px] text-muted-foreground text-center">
        Double-cliquez pour ajouter une source — glissez pour perturber le champ
      </p>
      <div className="flex items-center gap-4 text-[12px] text-muted-foreground justify-center">
        <label className="flex items-center gap-1.5">
          <span>Fréquence</span>
          <input
            className="w-16"
            max={10}
            min={1}
            onChange={(e) => setFrequency(Number(e.target.value))}
            step={0.5}
            type="range"
            value={frequency}
          />
          <span className="w-8 text-right">{frequency}</span>
        </label>
        <label className="flex items-center gap-1.5">
          <span>Amplitude</span>
          <input
            className="w-16"
            max={1}
            min={0.1}
            onChange={(e) => setAmplitude(Number(e.target.value))}
            step={0.1}
            type="range"
            value={amplitude}
          />
          <span className="w-8 text-right">{amplitude}</span>
        </label>
        <select
          className="rounded-md border border-border/20 bg-muted/10 px-2 py-0.5 text-[11px]"
          onChange={(e) => setColorMode(e.target.value as typeof colorMode)}
          value={colorMode}
        >
          <option value="ocean">Océan</option>
          <option value="thermal">Thermique</option>
          <option value="plasma">Plasma</option>
        </select>
        <button
          className="rounded-md px-2 py-0.5 text-[11px] bg-muted/30 hover:bg-muted/50"
          onClick={reset}
          type="button"
        >
          Clear
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 justify-center">
        {sources.map((src, i) => (
          <div
            className="flex items-center gap-1.5 text-[11px] rounded-md border border-border/20 bg-muted/10 px-2 py-0.5"
            key={src.id}
          >
            <span className="text-muted-foreground">S{i + 1}</span>
            <button
              className="text-muted-foreground/50 hover:text-destructive"
              onClick={() =>
                setSources((p) => p.filter((s) => s.id !== src.id))
              }
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

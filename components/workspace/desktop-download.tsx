// components/workspace/desktop-download.tsx
"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const DESKTOP_DOWNLOAD_URL =
  "https://github.com/phaladamou/employee-platform/releases";

const MODULES = 25;

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function inFinder(row: number, col: number): boolean {
  const inCorner = (r0: number, c0: number) =>
    row >= r0 && row < r0 + 7 && col >= c0 && col < c0 + 7;
  return (
    inCorner(0, 0) || inCorner(0, MODULES - 7) || inCorner(MODULES - 7, 0)
  );
}

// Faux QR deterministe (visuel d'attente, non scannable) : motifs de
// reperage aux 3 coins + modules derives du hash de `value`. Quand
// le vrai QR arrive, remplacer ce seul composant.
function QrFigure({ value }: { value: string }) {
  let seed = hashSeed(value);
  const next = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const cells: boolean[] = Array.from({ length: MODULES * MODULES }, () =>
    next() > 0.52
  );
  const finder = (key: string, x: number, y: number) => (
    <g key={key}>
      <rect fill="#111" height={7} width={7} x={x} y={y} />
      <rect fill="#fff" height={5} width={5} x={x + 1} y={y + 1} />
      <rect fill="#111" height={3} width={3} x={x + 2} y={y + 2} />
    </g>
  );

  return (
    <svg
      aria-label="QR code placeholder"
      className="size-40"
      role="img"
      viewBox={`-1 -1 ${MODULES + 2} ${MODULES + 2}`}
    >
      <rect fill="#fff" height={MODULES + 2} width={MODULES + 2} x={-1} y={-1} />
      {cells.map((filled, index) => {
        if (!filled) return null;
        const row = Math.floor(index / MODULES);
        const col = index % MODULES;
        if (inFinder(row, col)) return null;
        return (
          <rect
            fill="#111"
            height={1}
            key={index}
            width={1}
            x={col}
            y={row}
          />
        );
      })}
      {finder("tl", 0, 0)}
      {finder("tr", MODULES - 7, 0)}
      {finder("bl", 0, MODULES - 7)}
    </svg>
  );
}

export function DesktopDownload({ url = DESKTOP_DOWNLOAD_URL }: { url?: string }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <Button asChild size="sm" variant="outline">
          <a href={url} rel="noreferrer" target="_blank">
            <DownloadIcon className="size-4" />
            Download for Desktop
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent
        align="end"
        className="border-0 bg-transparent p-0 shadow-none [&>span]:hidden"
        side="bottom"
        sideOffset={8}
      >
        <div className="overflow-hidden rounded-xl border border-border/60 bg-white p-3 shadow-lg">
          <QrFigure value={url} />
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

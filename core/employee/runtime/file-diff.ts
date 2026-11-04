// core/employee/runtime/file-diff.ts
//
// Diff ligne-a-ligne pur (Myers) : sert la timeline "Changes" de
// l'IDE (fichiers ecrits par write_file : ancien contenu capture
// avant execution vs nouveau contenu). Zero dependance.
export type DiffRowType = "same" | "add" | "del";

export interface DiffRow {
  readonly type: DiffRowType;
  /** Numero de ligne 1-base, null quand absent de ce cote. */
  readonly oldNo: number | null;
  readonly newNo: number | null;
  readonly text: string;
}

export interface FileDiff {
  readonly added: number;
  readonly removed: number;
  /** Lignes unifiees (bornees a DIFF_MAX_ROWS). */
  readonly rows: readonly DiffRow[];
  /** Vrai si le detail est incomplet (compteurs exacts). */
  readonly truncated: boolean;
}

/** Plafond de lignes detaillees (compteurs toujours exacts). */
export const DIFF_MAX_ROWS = 400;
/** Garde-fou Myers : au-dela, detail abandonne (compteurs par repli). */
const DIFF_MAX_LINES = 20_000;
const DIFF_MAX_D = 2000;

function splitLines(text: string): string[] {
  if (text === "") {
    return [];
  }
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

interface EditScript {
  readonly type: "same" | "add" | "del";
}

/**
 * Plus court script d'edition (Myers, greedy O(ND)). Retourne null
 * quand la distance depasse le budget (fichiers quasi disjoints).
 */
function myers(a: string[], b: string[], maxD: number): EditScript[] | null {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const offset = max;
  const size = 2 * max + 1;
  let v: number[] = new Array<number>(size).fill(-1);
  v[offset + 1] = 0;
  const trace: number[][] = [];

  for (let d = 0; d <= Math.min(max, maxD); d += 1) {
    const current = [...v];
    for (let k = -d; k <= d; k += 2) {
      const index = offset + k;
      let x: number;
      if (k === -d || (k !== d && v[index - 1] < v[index + 1])) {
        x = v[index + 1];
      } else {
        x = v[index - 1] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      current[index] = x;
      if (x >= n && y >= m) {
        trace.push(current);
        return backtrack(trace, a, b, offset);
      }
    }
    trace.push(current);
    v = current;
  }
  return null;
}

function backtrack(
  trace: number[][],
  a: string[],
  b: string[],
  offset: number
): EditScript[] {
  const script: EditScript[] = [];
  let x = a.length;
  let y = b.length;
  for (let d = trace.length - 1; d > 0; d -= 1) {
    const v = trace[d - 1];
    const k = x - y;
    const index = offset + k;
    let prevK: number;
    if (k === -d || (k !== d && v[index - 1] < v[index + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = v[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      script.push({ type: "same" });
      x -= 1;
      y -= 1;
    }
    if (x === prevX) {
      script.push({ type: "add" });
    } else {
      script.push({ type: "del" });
    }
    x = prevX;
    y = prevY;
  }
  while (x > 0 && y > 0) {
    script.push({ type: "same" });
    x -= 1;
    y -= 1;
  }
  script.reverse();
  return script;
}

/**
 * Diff de deux contenus texte. Compteurs toujours exacts ; le
 * detail est borne (DIFF_MAX_ROWS, centre sur les changements :
 * contexte elague equitablement de chaque cote si besoin).
 */
export function diffLines(
  oldText: string,
  newText: string,
  maxRows: number = DIFF_MAX_ROWS
): FileDiff {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  if (a.length > DIFF_MAX_LINES || b.length > DIFF_MAX_LINES) {
    return {
      added: b.length,
      removed: a.length,
      rows: [],
      truncated: true,
    };
  }
  const script = myers(a, b, DIFF_MAX_D);
  if (!script) {
    return {
      added: b.length,
      removed: a.length,
      rows: [],
      truncated: true,
    };
  }
  let added = 0;
  let removed = 0;
  let oldNo = 0;
  let newNo = 0;
  const all: DiffRow[] = script.map((op) => {
    if (op.type === "same") {
      oldNo += 1;
      newNo += 1;
      return { type: op.type, oldNo, newNo, text: a[oldNo - 1] };
    }
    if (op.type === "add") {
      added += 1;
      newNo += 1;
      return { type: op.type, oldNo: null, newNo, text: b[newNo - 1] };
    }
    removed += 1;
    oldNo += 1;
    return { type: op.type, oldNo, newNo: null, text: a[oldNo - 1] };
  });
  if (all.length <= Math.max(1, maxRows)) {
    return { added, removed, rows: all, truncated: false };
  }
  // Elague le contexte lointain en gardant tous les changements :
  // fenetres de contexte autour de chaque changement, fusionnees.
  const changed = all
    .map((row, index) => (row.type === "same" ? -1 : index))
    .filter((index) => index >= 0);
  const budget = Math.max(1, maxRows);
  const perChange = Math.max(
    1,
    Math.floor((budget - changed.length) / Math.max(1, changed.length * 2))
  );
  const keep = new Set<number>(changed);
  for (const index of changed) {
    for (let delta = 1; delta <= perChange; delta += 1) {
      if (index - delta >= 0) keep.add(index - delta);
      if (index + delta < all.length) keep.add(index + delta);
    }
  }
  const rows = all.filter((_, index) => keep.has(index)).slice(0, budget);
  return { added, removed, rows, truncated: true };
}

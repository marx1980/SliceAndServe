import { findSolution } from '../analysis/solver';
import { createInitialState } from '../generation/expand';
import type {
  FixedLayout,
  GameState,
  LevelDefinition,
  OrderDefinition,
  TrayMode,
} from '../model/types';

const PREFIX = 'SSR1:';

/** Turns a board position into a Rescue puzzle: the plates on the board, then the tray and queue. */
export function rescueFromState(
  state: GameState,
  base: LevelDefinition,
  id: string,
  title: string,
): LevelDefinition {
  const cells = state.board.flatMap((p, cell) => (p ? [{ cell, slices: [...p.slices] }] : []));
  const queue = [
    ...state.tray.flatMap((p) => (p ? [[...p.slices]] : [])),
    ...state.queue.slice(state.queueIndex).map((p) => [...p.slices]),
  ];
  const orders: OrderDefinition[] = [];
  state.orders.forEach((spec, i) => {
    const prog = state.orderProgress[i];
    if (!prog || prog.complete) return;
    const left = prog.target - prog.value;
    if (spec.kind === 'complete-flavor')
      orders.push({
        kind: 'complete-flavor',
        flavor: base.flavors[spec.flavor] as string,
        count: left,
      });
    else if (spec.kind === 'complete-any') orders.push({ kind: 'complete-any', count: left });
    else if (spec.kind === 'complete-distinct')
      orders.push({ kind: 'complete-distinct', count: left });
    else orders.push({ kind: 'chain', depth: spec.depth });
  });
  const mask = state.playable.length
    ? Array.from({ length: state.rows }, (_, r) =>
        state.playable
          .slice(r * state.columns, (r + 1) * state.columns)
          .map((p) => (p ? '#' : '.'))
          .join(''),
      )
    : undefined;
  return {
    schemaVersion: 1,
    id,
    title,
    rows: state.rows,
    columns: state.columns,
    ...(mask && mask.some((r) => r.includes('.')) ? { mask } : {}),
    cakeSize: state.ruleset.cakeSize,
    flavors: base.flavors,
    generation: {
      seed: `rescue:${id}`,
      cakesPerFlavor: [],
      startingPlates: cells.length,
      minSlices: 1,
      maxSlices: state.ruleset.cakeSize,
      maxFlavorsPerPlate: base.flavors.length,
    },
    layout: { cells, queue },
    orders,
    moveTarget: 999,
    ...(state.allowedTools.length ? { allowedTools: state.allowedTools } : {}),
  };
}

/**
 * Walks back along a finished timeline to the latest position the solver can still win from.
 * Returns the index into `states`, or null when none (within the budget) can be won.
 */
export function lastRescuableIndex(states: readonly GameState[], budget = 40_000): number | null {
  for (let i = states.length - 1; i >= 0; i--) {
    const s = states[i] as GameState;
    if (s.status !== 'playing') continue;
    if (findSolution(s, budget).solved) return i;
  }
  return null;
}

export function encodeRescue(level: LevelDefinition): string {
  const json = JSON.stringify({
    t: level.title,
    r: level.rows,
    c: level.columns,
    m: level.mask,
    k: level.cakeSize,
    f: level.flavors,
    o: level.orders,
    l: level.layout,
    x: level.allowedTools,
  });
  return (
    PREFIX +
    btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
  );
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** Parses and validates a Rescue code. Returns null for anything malformed. */
export function decodeRescue(text: string, id: string): LevelDefinition | null {
  const t = text.trim();
  if (!t.startsWith(PREFIX)) return null;
  try {
    const b64 = t.slice(PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const o = JSON.parse(decodeURIComponent(escape(atob(b64)))) as Record<string, unknown>;
    const rows = o.r;
    const columns = o.c;
    const cakeSize = o.k;
    const flavors = o.f;
    const layout = o.l as FixedLayout | undefined;
    if (!isNum(rows) || !isNum(columns) || !isNum(cakeSize)) return null;
    if (rows < 1 || rows > 8 || columns < 1 || columns > 8 || cakeSize < 2 || cakeSize > 8)
      return null;
    if (!Array.isArray(flavors) || flavors.length < 1 || flavors.length > 8) return null;
    if (!flavors.every((f) => typeof f === 'string')) return null;
    if (!layout || !Array.isArray(layout.cells) || !Array.isArray(layout.queue)) return null;
    const n = flavors.length;
    const okSlices = (s: unknown): boolean =>
      Array.isArray(s) &&
      s.length >= 1 &&
      s.length <= cakeSize &&
      s.every((x) => isNum(x) && x >= 0 && x < n);
    const seen = new Set<number>();
    for (const c of layout.cells) {
      if (!isNum(c.cell) || c.cell < 0 || c.cell >= rows * columns || seen.has(c.cell)) return null;
      if (!okSlices(c.slices)) return null;
      seen.add(c.cell);
    }
    if (layout.queue.length > 60 || !layout.queue.every(okSlices)) return null;
    if (!Array.isArray(o.o) || o.o.length < 1 || o.o.length > 6) return null;
    const mask = Array.isArray(o.m) ? (o.m as string[]) : undefined;
    if (
      mask &&
      (mask.length !== rows || !mask.every((r) => typeof r === 'string' && r.length === columns))
    )
      return null;
    const level: LevelDefinition = {
      schemaVersion: 1,
      id,
      title: typeof o.t === 'string' ? o.t.slice(0, 24) : 'Rescue',
      rows,
      columns,
      ...(mask ? { mask } : {}),
      cakeSize,
      flavors: flavors as string[],
      generation: {
        seed: `rescue:${id}`,
        cakesPerFlavor: [],
        startingPlates: layout.cells.length,
        minSlices: 1,
        maxSlices: cakeSize,
        maxFlavorsPerPlate: n,
      },
      layout,
      orders: o.o as OrderDefinition[],
      moveTarget: 999,
      ...(Array.isArray(o.x) ? { allowedTools: o.x as LevelDefinition['allowedTools'] } : {}),
    };
    const s = createInitialState(level);
    if (s.board.every((p) => p === null) && layout.queue.length === 0) return null;
    return level;
  } catch {
    return null;
  }
}

export type RescueCheck = 'solvable' | 'unsolvable' | 'unknown';

/** Solver check for a Rescue puzzle in one tray model. */
export function checkRescue(
  level: LevelDefinition,
  trayMode: TrayMode,
  budget = 200_000,
): RescueCheck {
  const r = findSolution(createInitialState(level, { trayMode }), budget);
  return r.solved ? 'solvable' : r.complete ? 'unsolvable' : 'unknown';
}

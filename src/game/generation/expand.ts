import type {
  GameState,
  LevelDefinition,
  OrderProgress,
  OrderSpec,
  Plate,
  TrayMode,
} from '../model/types';
import { createRng } from '../rules/rng';

export interface NewGameOptions {
  trayMode?: TrayMode;
  diagonal?: boolean;
}

function playableFrom(level: LevelDefinition): boolean[] {
  const out: boolean[] = [];
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.columns; c++) {
      out.push(level.mask ? level.mask[r]?.[c] === '#' : true);
    }
  }
  return out;
}

function resolveOrders(level: LevelDefinition): { specs: OrderSpec[]; progress: OrderProgress[] } {
  const specs: OrderSpec[] = [];
  const progress: OrderProgress[] = [];
  for (const o of level.orders) {
    if (o.kind === 'complete-flavor') {
      const idx = level.flavors.indexOf(o.flavor);
      if (idx < 0) throw new Error(`Unknown flavour in order: ${o.flavor}`);
      specs.push({ kind: 'complete-flavor', flavor: idx, count: o.count });
      progress.push({ value: 0, target: o.count, complete: false });
    } else if (o.kind === 'chain') {
      specs.push(o);
      progress.push({ value: 0, target: o.depth, complete: false });
    } else {
      specs.push(o);
      progress.push({ value: 0, target: o.count, complete: false });
    }
  }
  return { specs, progress };
}

interface Layout {
  start: Array<{ cell: number; plate: Plate }>;
  queue: Plate[];
}

function tryLayout(level: LevelDefinition, playable: boolean[], attempt: number): Layout | null {
  const g = level.generation;
  const rng = createRng(`${g.seed}#${attempt}`);
  const pool: number[] = [];
  g.cakesPerFlavor.forEach((cakes, f) => {
    for (let i = 0; i < cakes * level.cakeSize; i++) pool.push(f);
  });
  const shuffled = rng.shuffle(pool);

  const plates: number[][] = [];
  let pos = 0;
  while (pos < shuffled.length) {
    const remaining = shuffled.length - pos;
    let size = rng.int(g.minSlices, g.maxSlices);
    if (size > remaining || remaining - size < g.minSlices) size = remaining;
    if (size > level.cakeSize) return null;
    const slices = shuffled.slice(pos, pos + size).sort((a, b) => a - b);
    if (new Set(slices).size > g.maxFlavorsPerPlate) return null;
    plates.push(slices);
    pos += size;
  }
  if (plates.length <= g.startingPlates) return null;

  const cells = rng.shuffle(playable.map((p, i) => (p ? i : -1)).filter((i) => i >= 0));
  const start = plates.slice(0, g.startingPlates).map((slices, i) => ({
    cell: cells[i] as number,
    plate: { id: `s${i}`, slices } as Plate,
  }));
  const queue = plates.slice(g.startingPlates).map((slices, i): Plate => ({ id: `q${i}`, slices }));

  // The starting board must already be stable: no adjacent plates sharing a flavour.
  const at = new Map(start.map((s) => [s.cell, s.plate]));
  for (const s of start) {
    const r = Math.floor(s.cell / level.columns);
    const c = s.cell % level.columns;
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
    ] as const) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= level.rows || nc >= level.columns) continue;
      const other = at.get(nr * level.columns + nc);
      if (other && other.slices.some((x) => s.plate.slices.includes(x))) return null;
    }
  }
  return { start, queue };
}

/** Deterministically expands an authored level into its initial game state. */
export function createInitialState(level: LevelDefinition, opts: NewGameOptions = {}): GameState {
  const playable = playableFrom(level);
  let layout: Layout | null = null;
  for (let attempt = 0; attempt < 2000 && !layout; attempt++) {
    layout = tryLayout(level, playable, attempt);
  }
  if (!layout) throw new Error(`Could not generate level ${level.id}`);

  const board: (Plate | null)[] = playable.map(() => null);
  for (const s of layout.start) board[s.cell] = s.plate;

  const traySize = 3;
  const tray: (Plate | null)[] = [];
  let queueIndex = 0;
  for (let i = 0; i < traySize; i++) {
    tray.push(layout.queue[queueIndex] ?? null);
    if (layout.queue[queueIndex]) queueIndex++;
  }
  const { specs, progress } = resolveOrders(level);
  return {
    schemaVersion: 1,
    levelId: level.id,
    rows: level.rows,
    columns: level.columns,
    playable,
    board,
    tray,
    queue: layout.queue,
    queueIndex,
    ruleset: {
      cakeSize: level.cakeSize,
      trayMode: opts.trayMode ?? 'slot',
      traySize,
      diagonal: opts.diagonal ?? false,
    },
    flavorCount: level.flavors.length,
    orders: specs,
    orderProgress: progress,
    completedCakes: level.flavors.map(() => 0),
    score: 0,
    moveNumber: 0,
    status: 'playing',
  };
}

/** Build a state from explicit plates, for tests and fixtures. */
export function stateFromPlates(args: {
  rows: number;
  columns: number;
  cells: Array<{ row: number; column: number; slices: number[] }>;
  tray?: number[][];
  queue?: number[][];
  flavorCount?: number;
  cakeSize?: number;
  trayMode?: TrayMode;
  diagonal?: boolean;
  orders?: OrderSpec[];
  mask?: boolean[];
}): GameState {
  const board: (Plate | null)[] = Array.from({ length: args.rows * args.columns }, () => null);
  args.cells.forEach((c, i) => {
    board[c.row * args.columns + c.column] = {
      id: `b${i}`,
      slices: c.slices.slice().sort((a, b) => a - b),
    };
  });
  const toPlate = (slices: number[], id: string): Plate => ({
    id,
    slices: slices.slice().sort((a, b) => a - b),
  });
  const queue = (args.queue ?? []).map((s, i) => toPlate(s, `q${i}`));
  const trayDefs = args.tray ?? [];
  const tray: (Plate | null)[] = [0, 1, 2].map((i) =>
    trayDefs[i] ? toPlate(trayDefs[i] as number[], `t${i}`) : null,
  );
  const orders: OrderSpec[] = args.orders ?? [{ kind: 'complete-any', count: 99 }];
  return {
    schemaVersion: 1,
    levelId: 'test',
    rows: args.rows,
    columns: args.columns,
    playable: args.mask ?? Array.from({ length: args.rows * args.columns }, () => true),
    board,
    tray,
    queue,
    queueIndex: 0,
    ruleset: {
      cakeSize: args.cakeSize ?? 6,
      trayMode: args.trayMode ?? 'slot',
      traySize: 3,
      diagonal: args.diagonal ?? false,
    },
    flavorCount: args.flavorCount ?? 4,
    orders,
    orderProgress: orders.map((o) => ({
      value: 0,
      target: o.kind === 'chain' ? o.depth : o.count,
      complete: false,
    })),
    completedCakes: Array.from({ length: args.flavorCount ?? 4 }, () => 0),
    score: 0,
    moveNumber: 0,
    status: 'playing',
  };
}

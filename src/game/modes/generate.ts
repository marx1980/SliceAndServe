import { createInitialState } from '../generation/expand';
import type { FlavorId, LevelDefinition, OrderDefinition, ToolId } from '../model/types';

export const FLAVOR_ORDER: readonly FlavorId[] = [
  'strawberry',
  'chocolate',
  'lemon',
  'pistachio',
  'blueberry',
];

export interface GenSpec {
  id: string;
  title: string;
  seed: string;
  rows: number;
  columns: number;
  mask?: string[];
  /** Cakes per flavour, in `FLAVOR_ORDER` order. */
  cakes: number[];
  start: number;
  minSlices: number;
  maxSlices: number;
  maxFlavorsPerPlate: number;
  orders: OrderDefinition[];
  tools?: ToolId[];
}

export function buildLevel(spec: GenSpec): LevelDefinition {
  return {
    schemaVersion: 1,
    id: spec.id,
    title: spec.title,
    rows: spec.rows,
    columns: spec.columns,
    ...(spec.mask ? { mask: spec.mask } : {}),
    cakeSize: 6,
    flavors: FLAVOR_ORDER.slice(0, spec.cakes.length),
    generation: {
      seed: spec.seed,
      cakesPerFlavor: spec.cakes,
      startingPlates: spec.start,
      minSlices: spec.minSlices,
      maxSlices: spec.maxSlices,
      maxFlavorsPerPlate: spec.maxFlavorsPerPlate,
    },
    orders: spec.orders,
    moveTarget: 999,
    ...(spec.tools && spec.tools.length > 0 ? { allowedTools: spec.tools } : {}),
  };
}

/** Builds a level, trying numbered seed variants until the generator accepts one. Null if none do. */
export function buildWithRetry(spec: GenSpec, attempts = 24): LevelDefinition | null {
  for (let k = 0; k < attempts; k++) {
    const level = buildLevel(k === 0 ? spec : { ...spec, seed: `${spec.seed}~${k}` });
    try {
      createInitialState(level);
      return level;
    } catch {
      // try the next seed variant
    }
  }
  return null;
}

// ---- Endless Service -------------------------------------------------------------------------

export interface EndlessRules {
  flavors: number;
  cakes: number;
  startingPlates: number;
  maxFlavorsPerPlate: number;
}

/** Generation rules for a stage. They grow slowly and are shown to the player. */
export function endlessRules(stage: number): EndlessRules {
  const s = Math.max(1, stage);
  const flavors = Math.min(5, 3 + Math.floor((s - 1) / 3));
  return {
    flavors,
    cakes: flavors * 2 + Math.min(4, Math.floor((s - 1) / 2)),
    startingPlates: Math.min(7, 3 + Math.floor(s / 2)),
    maxFlavorsPerPlate: Math.min(3, flavors),
  };
}

export function endlessLevel(seed: string, stage: number): LevelDefinition {
  const r = endlessRules(stage);
  const base = Math.floor(r.cakes / r.flavors);
  const cakes = Array.from(
    { length: r.flavors },
    (_, i) => base + (i < r.cakes % r.flavors ? 1 : 0),
  );
  const spec: GenSpec = {
    id: `E-${seed}-${stage}`,
    title: `${stage}`,
    seed: `endless:${seed}:${stage}`,
    rows: 4,
    columns: 5,
    cakes,
    start: r.startingPlates,
    minSlices: 2,
    maxSlices: 4,
    maxFlavorsPerPlate: r.maxFlavorsPerPlate,
    orders: [{ kind: 'complete-any', count: r.cakes }],
  };
  const level = buildWithRetry(spec);
  if (!level) throw new Error(`Could not generate endless stage ${stage}`);
  return level;
}

// ---- Zen Kitchen -----------------------------------------------------------------------------

export type ZenGoal = 'any' | 'distinct' | 'flavor';
export interface ZenConfig {
  goal: ZenGoal;
  amount: 2 | 4 | 6;
  flavors: 3 | 4 | 5;
  seed: string;
}

export function zenLevel(cfg: ZenConfig): LevelDefinition {
  const cakes = Array.from({ length: cfg.flavors }, () => 2);
  const amount = cfg.goal === 'distinct' ? Math.min(cfg.amount, cfg.flavors) : cfg.amount;
  if (cfg.goal === 'flavor') cakes[0] = Math.max(2, amount);
  const order: OrderDefinition =
    cfg.goal === 'any'
      ? {
          kind: 'complete-any',
          count: Math.min(
            amount,
            cakes.reduce((a, b) => a + b, 0),
          ),
        }
      : cfg.goal === 'distinct'
        ? { kind: 'complete-distinct', count: amount }
        : { kind: 'complete-flavor', flavor: 'strawberry', count: amount };
  const level = buildWithRetry({
    id: `Z-${cfg.goal}-${cfg.amount}-${cfg.flavors}-${cfg.seed}`,
    title: 'Zen',
    seed: `zen:${cfg.seed}:${cfg.goal}:${cfg.amount}:${cfg.flavors}`,
    rows: 4,
    columns: 5,
    cakes,
    start: 3,
    minSlices: 2,
    maxSlices: 4,
    maxFlavorsPerPlate: 3,
    orders: [order],
    tools: ['server', 'mitt', 'spoon', 'bin'],
  });
  if (!level) throw new Error('Could not generate zen puzzle');
  return level;
}

// ---- Pass-the-Cake ---------------------------------------------------------------------------

export function passLevel(seed: string, tools: boolean): LevelDefinition {
  const level = buildWithRetry({
    id: `P-${seed}-${tools ? 't' : 'n'}`,
    title: 'Pass',
    seed: `pass:${seed}`,
    rows: 4,
    columns: 5,
    cakes: [3, 3, 3, 3],
    start: 4,
    minSlices: 2,
    maxSlices: 4,
    maxFlavorsPerPlate: 3,
    orders: [{ kind: 'complete-any', count: 8 }],
    tools: tools ? ['server', 'mitt', 'spoon', 'bin'] : [],
  });
  if (!level) throw new Error('Could not generate shared puzzle');
  return level;
}

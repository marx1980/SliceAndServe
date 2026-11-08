import { writeFileSync } from 'node:fs';
import { findSolution } from '../src/game/analysis/solver';
import { createInitialState } from '../src/game/generation/expand';
import { buildWithRetry, type GenSpec } from '../src/game/modes/generate';
import type { DailyEntry } from '../src/game/modes/daily';
import { checkRescue, rescueFromState } from '../src/game/modes/rescue';
import type { LevelDefinition, OrderDefinition, TrayMode } from '../src/game/model/types';
import { applyCommand, legalMoves } from '../src/game/rules/engine';
import { AGENTS } from '../src/game/simulation/agents/agents';
import { runBatch } from '../src/game/simulation/play';

// Usage: npm run build-modes
// Regenerates src/content/modes.json: the daily pool, recipe challenges and rescue boards.
// Every entry is checked with the real solver in both tray models before it is kept.
const OUT = 'src/content/modes.json';
const modes: TrayMode[] = ['slot', 'batch'];

function line(level: LevelDefinition, mode: TrayMode, budget = 60_000): number | null {
  const r = findSolution(createInitialState(level, { trayMode: mode }), budget);
  return r.solved ? r.moves.length : null;
}

const any = (count: number): OrderDefinition => ({ kind: 'complete-any', count });

interface Tier {
  tier: 1 | 2 | 3;
  want: number;
  spec: Omit<GenSpec, 'id' | 'title' | 'seed'>;
  band: [number, number];
}

const TIERS: Tier[] = [
  {
    tier: 1,
    want: 12,
    band: [0.85, 1],
    spec: {
      rows: 4,
      columns: 5,
      cakes: [3, 3, 3, 3],
      start: 4,
      minSlices: 2,
      maxSlices: 4,
      maxFlavorsPerPlate: 3,
      orders: [any(6)],
    },
  },
  {
    tier: 2,
    want: 18,
    band: [0.7, 0.92],
    spec: {
      rows: 4,
      columns: 5,
      cakes: [3, 3, 3, 3],
      start: 4,
      minSlices: 2,
      maxSlices: 4,
      maxFlavorsPerPlate: 3,
      orders: [any(8)],
    },
  },
  {
    tier: 3,
    want: 12,
    band: [0.5, 0.8],
    spec: {
      rows: 4,
      columns: 5,
      cakes: [3, 3, 3, 3, 3],
      start: 5,
      minSlices: 2,
      maxSlices: 4,
      maxFlavorsPerPlate: 3,
      orders: [any(10)],
    },
  },
];

function buildDaily(): DailyEntry[] {
  const pool: DailyEntry[] = [];
  for (const t of TIERS) {
    let kept = 0;
    for (let i = 0; kept < t.want && i < 600; i++) {
      const level = buildWithRetry(
        { ...t.spec, id: `daily-${t.tier}-${i}`, title: 'Daily', seed: `daily:${t.tier}:${i}` },
        1,
      );
      if (!level) continue;
      const slotLine = line(level, 'slot');
      const batchLine = line(level, 'batch');
      if (slotLine === null || batchLine === null) continue;
      const rec = runBatch(level, AGENTS['human-error']!, 'slot', 0, 40);
      const rate = rec.filter((r) => r.won).length / rec.length;
      if (rate < t.band[0] || rate > t.band[1]) continue;
      pool.push({ tier: t.tier, level, slotLine, batchLine });
      kept++;
    }
    console.log(`tier ${t.tier}: ${kept}/${t.want}`);
    if (kept < t.want) process.exitCode = 1;
  }
  return pool;
}

function layoutOf(level: LevelDefinition): LevelDefinition {
  const s = createInitialState(level);
  return {
    ...level,
    layout: {
      cells: s.board.flatMap((p, cell) => (p ? [{ cell, slices: [...p.slices] }] : [])),
      queue: s.queue.map((p) => [...p.slices]),
    },
  };
}

function buildRecipes(): LevelDefinition[] {
  const out: LevelDefinition[] = [];
  const names = ['strawberry', 'chocolate', 'lemon', 'pistachio', 'blueberry'];
  for (let i = 0; i < 12; i++) {
    const flavors = 3 + Math.floor(i / 6);
    const cakes = Array.from({ length: flavors }, (_, f) => (f < 2 + (i % 3) ? 3 : 2));
    const fullOrders: OrderDefinition[] = cakes
      .map((c, f): OrderDefinition => ({
        kind: 'complete-flavor',
        flavor: names[f] as string,
        count: Math.min(c, f >= 2 ? 2 : 2 + ((f + i) % 2)),
      }))
      .slice(0, Math.min(flavors, 2 + Math.floor(i / 6)));
    const kept = old.recipes.find((l) => l.id === `C${String(i + 1).padStart(2, '0')}`);
    if (kept) {
      out.push(kept);
      continue;
    }
    for (let k = 0; k < 120; k++) {
      // Stubborn boards: after many failures ask for one flavour fewer.
      const orders = k < 60 ? fullOrders : fullOrders.slice(0, Math.max(1, fullOrders.length - 1));
      const base = buildWithRetry(
        {
          id: `C${String(i + 1).padStart(2, '0')}`,
          title: String(i + 1),
          seed: `recipe:${i}:${k}`,
          rows: 4,
          columns: 5,
          cakes,
          start: 3 + (i % 2),
          minSlices: 2,
          maxSlices: 4,
          maxFlavorsPerPlate: 3,
          orders,
        },
        1,
      );
      if (!base) continue;
      const level = layoutOf(base);
      if (modes.every((m) => line(level, m, 15_000) !== null)) {
        out.push(level);
        break;
      }
    }
  }
  return out;
}

function buildRescue(): LevelDefinition[] {
  const out: LevelDefinition[] = [];
  // Crowd the board on purpose: always take the placement that leaves the fewest empty cells, as
  // long as the solver still finds a win afterwards. The result is a near-full, still winnable board.
  for (let n = 0; out.length < 10 && n < 200; n++) {
    const base = buildWithRetry(
      {
        id: `base-${n}`,
        title: 'base',
        seed: `rescue-base:${n}`,
        rows: 4,
        columns: 5,
        cakes: [3, 3, 3, 3, 3],
        start: 6,
        minSlices: 2,
        maxSlices: 4,
        maxFlavorsPerPlate: 3,
        orders: [any(10)],
      },
      1,
    );
    if (!base) continue;
    let state = createInitialState(base, { trayMode: 'slot' });
    for (let step = 0; step < 40 && state.status === 'playing'; step++) {
      const empty = state.board.filter((p, i) => p === null && state.playable[i]).length;
      if (empty <= 4) break;
      const options = legalMoves(state)
        .map((cmd) => applyCommand(state, cmd))
        .sort((a, b) => a.analysis.emptyCellsAfter - b.analysis.emptyCellsAfter);
      const pick = options.find(
        (r) => r.nextState.status === 'playing' && findSolution(r.nextState, 3_000).solved,
      );
      if (!pick) break;
      state = pick.nextState;
    }
    const empty = state.board.filter((p, i) => p === null && state.playable[i]).length;
    if (state.status !== 'playing' || empty > 4) continue;
    const id = `R${String(out.length + 1).padStart(2, '0')}`;
    const level = rescueFromState(state, base, id, String(out.length + 1));
    if (modes.every((m) => checkRescue(level, m, 60_000) === 'solvable')) out.push(level);
  }
  return out;
}

// Usage: npm run build-modes [-- daily recipes rescue]  (default: all; others are kept from the existing file)
import { existsSync, readFileSync } from 'node:fs';
const want = process.argv.slice(2).filter((x) => ['daily', 'recipes', 'rescue'].includes(x));
const run = (k: string): boolean => want.length === 0 || want.includes(k);
const old = existsSync(OUT)
  ? (JSON.parse(readFileSync(OUT, 'utf8')) as {
      daily: DailyEntry[];
      recipes: LevelDefinition[];
      rescue: LevelDefinition[];
    })
  : { daily: [], recipes: [], rescue: [] };
const daily = run('daily') ? buildDaily() : old.daily;
console.log('daily', daily.length);
const recipes = run('recipes') ? buildRecipes() : old.recipes;
console.log('recipes', recipes.length);
const rescue = run('rescue') ? buildRescue() : old.rescue;
console.log('rescue', rescue.length);
// Re-read before writing so stages run in parallel processes do not overwrite each other.
const now = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as typeof old) : old;
writeFileSync(
  OUT,
  JSON.stringify({
    daily: run('daily') ? daily : now.daily,
    recipes: run('recipes') ? recipes : now.recipes,
    rescue: run('rescue') ? rescue : now.rescue,
  }),
);
if ((run('recipes') && recipes.length < 12) || (run('rescue') && rescue.length < 10))
  process.exitCode = 1;

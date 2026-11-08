import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SPECS, type LevelSpec } from './level-specs';
import { FLAVORS } from '../src/content/flavors';
import { createInitialState } from '../src/game/generation/expand';
import { findSolution } from '../src/game/analysis/solver';
import { AGENTS } from '../src/game/simulation/agents/agents';
import { runBatch } from '../src/game/simulation/play';
import { bandsFor } from '../src/game/simulation/balance';
import type { LevelDefinition, OrderDefinition } from '../src/game/model/types';

// Usage: tsx scripts/tune-levels.ts [--only L07,L08] [--force]
// Picks seeds and small knob changes so that each level lands in its balance band, and writes
// src/content/levels/campaign.json. Levels already present are kept unless --force or --only.
const OUT = 'src/content/levels/campaign.json';
const SEEDS = 'abcdefghijklmnop'.split('');

function build(
  spec: LevelSpec,
  seed: string,
  startDelta: number,
  orderDelta: number,
): LevelDefinition {
  const orders: OrderDefinition[] = spec.orders.map((o, i) => {
    if (i !== spec.orders.length - 1 || o.kind === 'chain') return o;
    return { ...o, count: Math.max(1, o.count + orderDelta) };
  });
  return {
    schemaVersion: 1,
    id: spec.id,
    title: spec.title,
    rows: spec.rows,
    columns: spec.columns,
    ...(spec.mask ? { mask: spec.mask } : {}),
    cakeSize: 6,
    flavors: Object.keys(FLAVORS).slice(0, spec.cakes.length),
    generation: {
      seed: `${spec.id}-${seed}`,
      cakesPerFlavor: spec.cakes,
      startingPlates: Math.max(2, spec.start + startDelta),
      minSlices: spec.minSlices,
      maxSlices: spec.maxSlices,
      maxFlavorsPerPlate: spec.maxFlavorsPerPlate,
    },
    orders,
    moveTarget: 99,
    allowedTools: spec.tools,
  };
}

function rate(level: LevelDefinition, mode: 'slot' | 'batch', n: number): number {
  const recs = runBatch(level, AGENTS['human-error']!, mode, 0, n);
  return recs.filter((r) => r.won).length / n;
}

interface Result {
  level: LevelDefinition | null;
  note: string;
}

function tune(spec: LevelSpec, index: number): Result {
  const band = bandsFor(index, spec.relief).find((b) => b.agent === 'human-error')!;
  const centre = (band.min + band.max) / 2;
  const near: string[] = [];
  const safe = (seed: string, sd: number, od: number): LevelDefinition | null => {
    try {
      const level = build(spec, seed, sd, od);
      createInitialState(level);
      return level;
    } catch {
      return null;
    }
  };
  // Step 1: find which order-size delta moves difficulty toward the band centre.
  const probes: Array<{ od: number; q: number }> = [];
  for (let od = -3; od <= 5; od++) {
    const level = SEEDS.map((sd) => safe(sd, 0, od)).find((l) => l !== null) ?? null;
    if (level) probes.push({ od, q: rate({ ...level, id: `${spec.id}p` }, 'slot', 60) });
  }
  probes.sort((x, y) => Math.abs(x.q - centre) - Math.abs(y.q - centre));
  const deltas = probes.slice(0, 3).map((p) => p.od);
  for (const od of deltas) {
    for (const sd of [0, 1, -1]) {
      for (const seed of SEEDS) {
        const level = safe(seed, sd, od);
        if (!level) continue;
        const quick = rate({ ...level, id: `${spec.id}q` }, 'slot', 60);
        if (quick < band.min - 0.08 || quick > band.max + 0.08) continue;
        const slot = rate({ ...level, id: `${spec.id}s` }, 'slot', 500);
        const batch = rate({ ...level, id: `${spec.id}b` }, 'batch', 500);
        near.push(`${seed}/${sd}/${od}: ${slot.toFixed(2)} ${batch.toFixed(2)}`);
        const inBand = (r: number): boolean => r >= band.min + 0.02 && r <= band.max - 0.02;
        if (!inBand(slot) || !inBand(batch)) continue;
        const okSolve = (['slot', 'batch'] as const).every(
          (m) => findSolution(createInitialState(level, { trayMode: m }), 400_000).solved,
        );
        if (!okSolve) continue;
        return {
          level,
          note: `seed ${seed} start${sd >= 0 ? '+' : ''}${sd} orders${od >= 0 ? '+' : ''}${od} -> ${slot.toFixed(2)}/${batch.toFixed(2)}`,
        };
      }
    }
  }
  return {
    level: null,
    note: `no fit for band ${band.min}-${band.max}; probes ${probes.map((p) => `${p.od}:${p.q.toFixed(2)}`).join(' ')}; near: ${near.slice(0, 6).join('; ')}`,
  };
}

if (!isMainThread) {
  const { id } = workerData as { id: string };
  const index = SPECS.findIndex((s) => s.id === id) + 5;
  parentPort!.postMessage({
    id,
    ...tune(
      SPECS.find((s) => s.id === id)!,
      index,
    ),
  });
} else {
  void main();
}

async function main(): Promise<void> {
  const argv = process.argv;
  const only = argv.includes('--only') ? (argv[argv.indexOf('--only') + 1] ?? '').split(',') : [];
  const force = argv.includes('--force');
  const have: LevelDefinition[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
  const todo = SPECS.filter((s) =>
    only.length ? only.includes(s.id) : force || !have.some((h) => h.id === s.id),
  );
  const queue = todo.map((s) => s.id);
  const results = new Map<string, LevelDefinition>();
  await Promise.all(
    Array.from({ length: Math.min(cpus().length, queue.length || 1) }, async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        const r = await new Promise<{ id: string } & Result>((resolve, reject) => {
          const w = new Worker(fileURLToPath(import.meta.url), {
            workerData: { id },
            execArgv: process.execArgv,
          });
          w.once('message', resolve);
          w.once('error', reject);
        });
        console.log(`${r.level ? 'OK  ' : 'FAIL'} ${id}: ${r.note}`);
        if (r.level) results.set(id, r.level);
      }
    }),
  );
  const merged = SPECS.map((s) => results.get(s.id) ?? have.find((h) => h.id === s.id)).filter(
    (l): l is LevelDefinition => !!l,
  );
  writeFileSync(OUT, JSON.stringify(merged, null, 1) + '\n');
  console.log(`Wrote ${merged.length} levels to ${OUT}`);
}

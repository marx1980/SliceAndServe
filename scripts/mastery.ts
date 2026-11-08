import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEVELS } from '../src/content/levels';
import { AGENTS } from '../src/game/simulation/agents/agents';
import { runBatch, type GameRecord } from '../src/game/simulation/play';
import { goalMet, playOutcome } from '../src/game/progression/mastery';
import { levelHash } from '../src/game/analysis/receipt';
import type { Command, MasteryGoal, TrayMode } from '../src/game/model/types';

// Usage: tsx scripts/mastery.ts
// Picks a mastery goal per level (rotating chain / score / tidy, no-tools on two levels) that
// ordinary play can reach in both tray models, and stores a replayable witness line for each.
const OUT = 'src/content/mastery.json';
const NO_TOOLS = new Set(['L14', 'L29']);
const WITNESS_AGENTS = ['human-error', 'combo', 'order'];
const RUNS = 150;

interface Pool {
  wins: GameRecord[];
}

function pool(levelId: string, mode: TrayMode): Pool {
  const level = LEVELS.find((l) => l.id === levelId)!;
  const wins: GameRecord[] = [];
  for (const a of WITNESS_AGENTS) {
    for (const r of runBatch(level, AGENTS[a]!, mode, 0, RUNS)) if (r.won) wins.push(r);
  }
  return { wins };
}

const frac = (p: Pool, f: (r: GameRecord) => boolean): number =>
  p.wins.length === 0 ? 0 : p.wins.filter(f).length / p.wins.length;

function pickGoal(index: number, id: string, slot: Pool, batch: Pool): MasteryGoal | null {
  if (NO_TOOLS.has(id)) return { kind: 'no-tools' };
  const order: Array<'chain' | 'score' | 'tidy'> = [
    (['chain', 'score', 'tidy'] as const)[index % 3]!,
    'score',
    'chain',
    'tidy',
  ];
  for (const kind of order) {
    if (kind === 'chain') {
      for (const depth of [3, 2]) {
        const ok = (p: Pool): boolean => frac(p, (r) => r.maxChain >= depth) >= 0.1;
        if (ok(slot) && ok(batch)) return { kind, depth };
      }
    } else if (kind === 'tidy') {
      for (const minEmpty of [3, 2]) {
        const ok = (p: Pool): boolean => frac(p, (r) => r.minEmpty >= minEmpty) >= 0.1;
        if (ok(slot) && ok(batch)) return { kind, minEmpty };
      }
    } else {
      const q = (p: Pool): number => {
        const s = p.wins.map((r) => r.finalScore).sort((a, b) => a - b);
        return s[Math.floor(s.length * 0.85)] ?? 0;
      };
      const points = Math.floor(Math.min(q(slot), q(batch)) / 100) * 100;
      if (points > 0) return { kind, points };
    }
  }
  return null;
}

if (!isMainThread) {
  const { id, index } = workerData as { id: string; index: number };
  const slot = pool(id, 'slot');
  const batch = pool(id, 'batch');
  const goal = pickGoal(index, id, slot, batch);
  const level = LEVELS.find((l) => l.id === id)!;
  const witness: Record<string, Command[]> = {};
  if (goal) {
    for (const [mode, p] of [
      ['slot', slot],
      ['batch', batch],
    ] as const) {
      const w = p.wins
        .filter((r) => goalMet(goal, playOutcome(level, mode, r.commands)))
        .sort((a, b) => a.commands.length - b.commands.length)[0];
      if (w) witness[mode] = w.commands;
    }
  }
  const best: Record<string, Command[]> = {};
  for (const [mode, p] of [
    ['slot', slot],
    ['batch', batch],
  ] as const) {
    const w = p.wins.sort((a, b) => a.commands.length - b.commands.length)[0];
    if (w) best[mode] = w.commands;
  }
  parentPort!.postMessage({ id, goal, witness, best, hash: levelHash(level) });
} else {
  void main();
}

async function main(): Promise<void> {
  const queue = LEVELS.map((l, index) => ({ id: l.id, index }));
  const out: Record<string, unknown> = {};
  await Promise.all(
    Array.from({ length: cpus().length }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const r = await new Promise<{
          id: string;
          goal: MasteryGoal | null;
          witness: Record<string, Command[]>;
          best: Record<string, Command[]>;
          hash: number;
        }>((resolve, reject) => {
          const w = new Worker(fileURLToPath(import.meta.url), {
            workerData: job,
            execArgv: process.execArgv,
          });
          w.once('message', resolve);
          w.once('error', reject);
        });
        const ok = r.goal && r.witness['slot'] && r.witness['batch'];
        console.log(`${ok ? 'OK  ' : 'FAIL'} ${r.id} ${JSON.stringify(r.goal)}`);
        if (ok) out[r.id] = { goal: r.goal, levelHash: r.hash, witness: r.witness, best: r.best };
      }
    }),
  );
  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUT, JSON.stringify(sorted) + '\n');
  console.log(`Wrote ${Object.keys(sorted).length} goals to ${OUT}`);
  void readFileSync;
}

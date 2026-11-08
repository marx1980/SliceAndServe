import { LEVELS } from '../src/content/levels';
import { createInitialState } from '../src/game/generation/expand';
import { applyCommand } from '../src/game/rules/engine';
import { AGENTS } from '../src/game/simulation/agents/agents';
import type { TrayMode } from '../src/game/model/types';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

const runs = Number(arg('runs', '1000'));
const agentId = arg('agent', 'random');
const mode = arg('mode', 'slot') as TrayMode;
const only = arg('level', '');
const format = arg('format', 'json');
const agent = AGENTS[agentId];
if (!agent) throw new Error(`Unknown agent ${agentId}`);

const rows = [];
for (const level of LEVELS.filter((l) => !only || l.id === only)) {
  let wins = 0;
  let totalMoves = 0;
  let maxChain = 0;
  let peakOccupancy = 0;
  const t0 = Date.now();
  for (let seed = 0; seed < runs; seed++) {
    let s = createInitialState(level, { trayMode: mode });
    let guard = 0;
    while (s.status === 'playing' && guard++ < 200) {
      const cmd = agent.chooseMove(s, `${level.id}:${seed}:${s.moveNumber}`);
      const r = applyCommand(s, cmd);
      maxChain = Math.max(maxChain, r.analysis.chainDepth);
      const playable = r.nextState.playable.filter(Boolean).length;
      peakOccupancy = Math.max(peakOccupancy, 1 - r.analysis.emptyCellsAfter / playable);
      s = r.nextState;
    }
    if (s.status === 'won') wins++;
    totalMoves += s.moveNumber;
  }
  rows.push({
    level: level.id,
    agent: agentId,
    trayMode: mode,
    runs,
    winRate: Number((wins / runs).toFixed(4)),
    avgMoves: Number((totalMoves / runs).toFixed(2)),
    maxChain,
    peakOccupancy: Number(peakOccupancy.toFixed(3)),
    ms: Date.now() - t0,
  });
}
if (format === 'csv') {
  const keys = Object.keys(rows[0] ?? {});
  console.log(keys.join(','));
  for (const r of rows) console.log(keys.map((k) => r[k as keyof typeof r]).join(','));
} else {
  console.log(JSON.stringify(rows, null, 2));
}

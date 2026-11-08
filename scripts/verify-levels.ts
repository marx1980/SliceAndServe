import { writeFileSync } from 'node:fs';
import { LEVELS } from '../src/content/levels';
import { createInitialState } from '../src/game/generation/expand';
import { verify } from '../src/game/analysis/solver';
import type { TrayMode } from '../src/game/model/types';

const modes: TrayMode[] = ['slot', 'batch'];
const receipts = [];
let failed = 0;
for (const level of LEVELS) {
  for (const trayMode of modes) {
    const t0 = Date.now();
    const state = createInitialState(level, { trayMode });
    const r = verify(state);
    const ms = Date.now() - t0;
    receipts.push({ ...r, ms });
    const ok = r.solvable && r.viableFirstMoves >= 3;
    if (!ok) failed++;
    console.log(
      `${ok ? 'OK  ' : 'FAIL'} ${level.id} ${trayMode.padEnd(5)} solvable=${r.solvable} ` +
        `viable=${r.viableFirstMoves}/${r.firstMoves} ${r.exact ? 'shortest' : 'solution'}=${r.shortest} ` +
        `routes=${r.routes ?? 'n/a'} exact=${r.exact} (${ms} ms)`,
    );
  }
}
if (process.argv.includes('--json'))
  writeFileSync('verification.json', JSON.stringify(receipts, null, 2));
if (failed > 0) {
  console.error(`${failed} verification(s) failed`);
  process.exit(1);
}

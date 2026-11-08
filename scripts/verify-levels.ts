import { writeFileSync } from 'node:fs';
import { LEVELS } from '../src/content/levels';
import { makeReceipt, type Receipt } from '../src/game/analysis/receipt';
import type { TrayMode } from '../src/game/model/types';

// Usage: npm run verify-levels [-- --write]   (--write stores receipts in src/content/receipts.json)
const modes: TrayMode[] = ['slot', 'batch'];
const receipts: Receipt[] = [];
let failed = 0;
for (const level of LEVELS) {
  for (const trayMode of modes) {
    const t0 = Date.now();
    const r = makeReceipt(level, trayMode);
    receipts.push(r);
    const ok = r.solvable && r.viableFirstMoves >= 3;
    if (!ok) failed++;
    console.log(
      `${ok ? 'OK  ' : 'FAIL'} ${level.id} ${trayMode.padEnd(5)} solvable=${r.solvable} ` +
        `viable=${r.viableFirstMoves}/${r.firstMoves} ${r.exact ? 'shortest' : 'solution'}=${r.shortest} ` +
        `routes${r.exact ? '=' : '>='}${r.routes} (${Date.now() - t0} ms)`,
    );
  }
}
if (process.argv.includes('--write')) {
  writeFileSync('src/content/receipts.json', JSON.stringify(receipts, null, 1) + '\n');
  console.log('Wrote src/content/receipts.json');
}
if (failed > 0) {
  console.error(`${failed} verification(s) failed`);
  process.exit(1);
}

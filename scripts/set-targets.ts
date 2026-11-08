import { readFileSync, writeFileSync } from 'node:fs';
import { LEVELS } from '../src/content/levels';
import type { Receipt } from '../src/game/analysis/receipt';
import type { Command } from '../src/game/model/types';

// Usage: tsx scripts/set-targets.ts
// Move target (hat 2) = best known winning line in the slower tray model + 3. "Best known" is the
// shortest of the solver's line and the shortest winning game found by the simulation agents.
const receipts = JSON.parse(readFileSync('src/content/receipts.json', 'utf8')) as Receipt[];
const mastery = JSON.parse(readFileSync('src/content/mastery.json', 'utf8')) as Record<
  string,
  { best: Record<string, Command[]> }
>;
const targets: Record<string, number> = {};
for (const level of LEVELS) {
  const perMode = (['slot', 'batch'] as const).map((mode) => {
    const r = receipts.find((x) => x.levelId === level.id && x.trayMode === mode);
    const fromReceipt = r?.shortest ?? Infinity;
    const fromAgents = mastery[level.id]?.best[mode]?.length ?? Infinity;
    return Math.min(fromReceipt, fromAgents);
  });
  targets[level.id] = Math.max(...perMode) + 3;
}
writeFileSync('src/content/targets.json', JSON.stringify(targets, null, 1) + '\n');
console.log(JSON.stringify(targets));

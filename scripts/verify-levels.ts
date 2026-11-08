import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEVELS } from '../src/content/levels';
import { makeReceipt, receiptStatus, type Receipt } from '../src/game/analysis/receipt';
import type { TrayMode } from '../src/game/model/types';

// Usage: npm run verify-levels [-- --write] [--force] [--level L07]
//   --write  store receipts in src/content/receipts.json
//   --force  recompute receipts that are already current
// Current receipts are reused, so only new or edited levels are searched again.
const FILE = 'src/content/receipts.json';
const modes: TrayMode[] = ['slot', 'batch'];

interface Job {
  levelId: string;
  trayMode: TrayMode;
}

if (!isMainThread) {
  const { levelId, trayMode } = workerData as Job;
  const t0 = Date.now();
  const receipt = makeReceipt(
    LEVELS.find((l) => l.id === levelId)!,
    trayMode,
  );
  parentPort!.postMessage({ receipt, ms: Date.now() - t0 });
} else {
  void main();
}

async function main(): Promise<void> {
  const argv = process.argv;
  const force = argv.includes('--force');
  const only = argv.includes('--level') ? argv[argv.indexOf('--level') + 1] : undefined;
  const stored: Receipt[] = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : [];
  const receipts = new Map<string, Receipt>();
  const queue: Job[] = [];
  for (const level of LEVELS) {
    for (const trayMode of modes) {
      const key = `${level.id}|${trayMode}`;
      const have = stored.find((r) => r.levelId === level.id && r.trayMode === trayMode);
      const current = receiptStatus(level, have) === 'verified' && have?.shortestLine !== undefined;
      if (have && current && !force && (!only || only !== level.id)) receipts.set(key, have);
      else if (!only || only === level.id) queue.push({ levelId: level.id, trayMode });
    }
  }
  let failed = 0;
  await Promise.all(
    Array.from({ length: Math.min(cpus().length, Math.max(1, queue.length)) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const { receipt: r, ms } = await new Promise<{ receipt: Receipt; ms: number }>(
          (resolve, reject) => {
            const w = new Worker(fileURLToPath(import.meta.url), {
              workerData: job,
              execArgv: process.execArgv,
            });
            w.once('message', resolve);
            w.once('error', reject);
          },
        );
        receipts.set(`${job.levelId}|${job.trayMode}`, r);
        const ok = r.solvable && r.viableFirstMoves >= 3;
        if (!ok) failed++;
        console.log(
          `${ok ? 'OK  ' : 'FAIL'} ${job.levelId} ${job.trayMode.padEnd(5)} solvable=${r.solvable} ` +
            `viable=${r.viableFirstMoves}/${r.firstMoves} shortest=${r.shortest}${r.shortestProven ? '' : '?'} ` +
            `routes${r.exact ? '=' : '>='}${r.routes} (${ms} ms)`,
        );
      }
    }),
  );
  const ordered = LEVELS.flatMap((l) => modes.map((m) => receipts.get(`${l.id}|${m}`))).filter(
    (r): r is Receipt => !!r,
  );
  if (argv.includes('--write')) {
    writeFileSync(FILE, JSON.stringify(ordered, null, 1) + '\n');
    console.log(`Wrote ${FILE} (${ordered.length} receipts)`);
  }
  if (failed > 0) {
    console.error(`${failed} verification(s) failed`);
    process.exit(1);
  }
}

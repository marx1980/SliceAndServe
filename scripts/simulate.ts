import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEVELS } from '../src/content/levels';
import { AGENTS } from '../src/game/simulation/agents/agents';
import { runBatch, summarize, type GameRecord, type Summary } from '../src/game/simulation/play';
import { checkBalance } from '../src/game/simulation/balance';
import type { TrayMode } from '../src/game/model/types';

interface Job {
  level: string;
  agent: string;
  trayMode: TrayMode;
  seedFrom: number;
  seedCount: number;
}

if (!isMainThread) {
  // Worker: run one batch and send raw records back.
  const job = workerData as Job;
  const level = LEVELS.find((l) => l.id === job.level)!;
  const agent = AGENTS[job.agent]!;
  parentPort!.postMessage(runBatch(level, agent, job.trayMode, job.seedFrom, job.seedCount));
} else {
  void main();
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

function runJob(job: Job): Promise<GameRecord[]> {
  return new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), {
      workerData: job,
      execArgv: process.execArgv,
    });
    w.once('message', resolve);
    w.once('error', reject);
  });
}

async function main(): Promise<void> {
  const runs = Number(arg('runs', '1000'));
  const seedStart = Number(arg('seed-start', '0'));
  const agentIds = arg('agent', 'random,human-error,solver').split(',');
  const modes = arg('mode', 'slot,batch').split(',') as TrayMode[];
  const only = arg('level', '');
  const out = arg('out', '');
  const threads = Number(arg('threads', String(Math.max(1, cpus().length))));
  for (const a of agentIds) if (!AGENTS[a]) throw new Error(`Unknown agent ${a}`);
  const levels = LEVELS.filter((l) => !only || l.id === only);

  // One job per (level, agent, mode, chunk); solver is deterministic so one run is enough.
  const jobs: Job[] = [];
  for (const level of levels)
    for (const agent of agentIds)
      for (const trayMode of modes) {
        const count = agent === 'solver' ? 1 : runs;
        const chunk = Math.max(1, Math.ceil(count / threads));
        for (let from = 0; from < count; from += chunk)
          jobs.push({
            level: level.id,
            agent,
            trayMode,
            seedFrom: seedStart + from,
            seedCount: Math.min(chunk, count - from),
          });
      }

  const t0 = Date.now();
  const results = new Map<string, GameRecord[]>();
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: threads }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const recs = await runJob(job);
        const key = `${job.level}|${job.agent}|${job.trayMode}`;
        results.set(key, [...(results.get(key) ?? []), ...recs]);
      }
    }),
  );
  const totalMs = Date.now() - t0;

  const summaries: Summary[] = [];
  for (const level of levels)
    for (const agent of agentIds)
      for (const mode of modes) {
        const recs = (results.get(`${level.id}|${agent}|${mode}`) ?? []).sort(
          (a, b) => a.seed - b.seed,
        );
        summaries.push(summarize(level.id, agent, mode, recs, totalMs));
      }

  const failures = flag('check')
    ? checkBalance(
        summaries,
        LEVELS.map((l) => l.id),
      )
    : [];

  const scalar = summaries.map(({ occupancyByTurn: _o, ...rest }) => rest);
  const csv = (): string => {
    const keys = Object.keys(scalar[0] ?? {});
    return [
      keys.join(','),
      ...scalar.map((r) => keys.map((k) => r[k as keyof typeof r] ?? '').join(',')),
    ].join('\n');
  };
  if (out) {
    mkdirSync(out, { recursive: true });
    writeFileSync(`${out}/simulation.json`, JSON.stringify({ summaries, failures }, null, 2));
    writeFileSync(`${out}/simulation.csv`, csv() + '\n');
  } else if (arg('format', 'json') === 'csv') console.log(csv());
  else console.log(JSON.stringify({ summaries, failures }, null, 2));

  if (flag('check') && failures.length > 0) {
    console.error(JSON.stringify({ failures }, null, 2));
    process.exitCode = 1;
  }
}

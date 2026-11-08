import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { LEVELS } from '../src/content/levels';
import type { Receipt } from '../src/game/analysis/receipt';
import type { Summary } from '../src/game/simulation/play';

// Usage: tsx scripts/difficulty-report.ts [simulation.json] [outDir]
// Reads a simulation run plus the stored receipts and writes reports/difficulty.{md,json,csv}.
const input = process.argv[2] ?? 'reports/simulation.json';
const outDir = process.argv[3] ?? 'reports';
const { summaries } = JSON.parse(readFileSync(input, 'utf8')) as { summaries: Summary[] };
const receipts = JSON.parse(readFileSync('src/content/receipts.json', 'utf8')) as Receipt[];

const agents = [...new Set(summaries.map((s) => s.agent))];
const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;
const rows = LEVELS.flatMap((level) =>
  (['slot', 'batch'] as const).map((mode) => {
    const rec = receipts.find((r) => r.levelId === level.id && r.trayMode === mode);
    const rates: Record<string, number> = {};
    for (const a of agents)
      rates[a] =
        summaries.find((s) => s.level === level.id && s.agent === a && s.trayMode === mode)
          ?.winRate ?? NaN;
    const human = summaries.find(
      (s) => s.level === level.id && s.agent === 'human-error' && s.trayMode === mode,
    );
    return {
      level: level.id,
      title: level.title,
      trayMode: mode,
      moveTarget: level.moveTarget,
      shortest: rec?.shortest ?? null,
      shortestProven: rec?.shortestProven ?? false,
      routes: rec?.routes ?? null,
      viableFirstMoves: rec ? `${rec.viableFirstMoves}/${rec.firstMoves}` : '',
      avgMovesHumanError: human?.avgMoves ?? null,
      avgPeakOccupancy: human?.avgPeakOccupancy ?? null,
      ...Object.fromEntries(agents.map((a) => [`win_${a}`, rates[a]])),
    };
  }),
);

mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/difficulty.json`, JSON.stringify(rows, null, 2) + '\n');
const keys = Object.keys(rows[0] ?? {});
writeFileSync(
  `${outDir}/difficulty.csv`,
  [
    keys.join(','),
    ...rows.map((r) => keys.map((k) => String(r[k as keyof typeof r] ?? '')).join(',')),
  ].join('\n') + '\n',
);

const head = ['Level', 'Tray', 'Target', 'Shortest', 'Viable', ...agents.map((a) => `${a}`)];
const md = [
  '# Difficulty report',
  '',
  'Win rates per agent; shortest line marked `?` when not proven minimal.',
  '',
  `| ${head.join(' | ')} |`,
  `|${head.map(() => ' --- ').join('|')}|`,
  ...rows.map((r) => {
    const cells = [
      `${r.level} ${r.title}`,
      r.trayMode,
      String(r.moveTarget),
      `${r.shortest ?? '-'}${r.shortestProven ? '' : '?'}`,
      r.viableFirstMoves,
      ...agents.map((a) => pct(r[`win_${a}` as keyof typeof r] as number)),
    ];
    return `| ${cells.join(' | ')} |`;
  }),
  '',
].join('\n');
writeFileSync(`${outDir}/difficulty.md`, md);
console.log(`Wrote ${outDir}/difficulty.{md,json,csv}`);

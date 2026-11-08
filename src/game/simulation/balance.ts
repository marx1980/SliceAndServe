import type { Summary } from './play';

/** Balancing targets from 05_TESTING_SIMULATION_AND_ACCEPTANCE.md. Targets, not hard rules. */
export interface Band {
  agent: string;
  min: number;
  max: number;
  label: string;
}

/** Bands for the level at 0-based `index` in the campaign order. */
export function bandsFor(index: number, relief = false): Band[] {
  const bands: Band[] = [];
  if (index < 3) {
    bands.push({ agent: 'random', min: 0.8, max: 1, label: 'levels 1-3: random above 80%' });
  }
  if (index < 3) {
    // Random above 80% already implies a strong agent wins nearly always, so only a floor applies.
    bands.push({
      agent: 'human-error',
      min: 0.85,
      max: 1,
      label: 'levels 1-3: ordinary agent at least 85%',
    });
  } else if (index < 10) {
    bands.push({
      agent: 'human-error',
      min: 0.85,
      max: 0.95,
      label: 'levels 4-10: ordinary agent 85-95%',
    });
  } else if (relief) {
    bands.push({ agent: 'human-error', min: 0.85, max: 0.95, label: 'relief levels: 85-95%' });
  } else if (index < 30) {
    bands.push({ agent: 'human-error', min: 0.7, max: 0.85, label: 'levels 11-30: 70-85%' });
  }
  bands.push({ agent: 'solver', min: 1, max: 1, label: 'solver wins every campaign level' });
  return bands;
}

export interface BalanceFailure {
  level: string;
  trayMode: string;
  agent: string;
  metric: string;
  expected: string;
  actual: number | null;
  label: string;
}

/** Compares summaries with the bands; returns machine-readable failures. */
/** Relief levels sit in an easier band than their neighbours. */
export const RELIEF_LEVELS: ReadonlySet<string> = new Set(['L12', 'L27']);

export function checkBalance(summaries: Summary[], levelIds: string[]): BalanceFailure[] {
  const failures: BalanceFailure[] = [];
  levelIds.forEach((id, index) => {
    for (const band of bandsFor(index, RELIEF_LEVELS.has(id))) {
      for (const s of summaries.filter((x) => x.level === id && x.agent === band.agent)) {
        // Bands are targets: fail only when the 95% interval misses the band entirely.
        // The deterministic solver must hit its band exactly.
        const exact = band.agent === 'solver';
        const lo = exact ? s.winRate : s.winRateLow;
        const hi = exact ? s.winRate : s.winRateHigh;
        if (hi < band.min || lo > band.max) {
          failures.push({
            level: id,
            trayMode: s.trayMode,
            agent: band.agent,
            metric: 'winRate',
            expected: `${band.min}-${band.max}`,
            actual: s.winRate,
            label: band.label,
          });
        }
      }
    }
  });
  return failures;
}

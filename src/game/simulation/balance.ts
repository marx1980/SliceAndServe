import type { Summary } from './play';

/** Balancing targets from 05_TESTING_SIMULATION_AND_ACCEPTANCE.md. Targets, not hard rules. */
export interface Band {
  agent: string;
  min: number;
  max: number;
  label: string;
}

/** Bands for the level at 0-based `index` in the campaign order. */
export function bandsFor(index: number): Band[] {
  const bands: Band[] = [];
  if (index < 3) {
    bands.push({ agent: 'random', min: 0.8, max: 1, label: 'levels 1-3: random above 80%' });
  }
  if (index < 10) {
    bands.push({
      agent: 'human-error',
      min: 0.85,
      max: 0.95,
      label: 'levels 1-10: ordinary agent 85-95%',
    });
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
export function checkBalance(summaries: Summary[], levelIds: string[]): BalanceFailure[] {
  const failures: BalanceFailure[] = [];
  levelIds.forEach((id, index) => {
    for (const band of bandsFor(index)) {
      for (const s of summaries.filter((x) => x.level === id && x.agent === band.agent)) {
        if (s.winRate < band.min || s.winRate > band.max) {
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

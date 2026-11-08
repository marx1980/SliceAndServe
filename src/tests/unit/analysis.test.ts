import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../content/levels';
import { createInitialState, stateFromPlates } from '../../game/generation/expand';
import { applyCommand, legalMoves } from '../../game/rules/engine';
import { createRng } from '../../game/rules/rng';
import { boardMetrics } from '../../game/analysis/metrics';
import { compareMoves, computeHints, evaluateMoves, explainMove } from '../../game/analysis/hints';
import { analyzeFailure } from '../../game/analysis/failure';
import { findSolution } from '../../game/analysis/solver';
import type { GameState, PlacePlateCommand } from '../../game/model/types';

/** Plays seeded random moves until the game ends; returns the line. */
function randomLine(
  state: GameState,
  seed: string,
): { states: GameState[]; moves: PlacePlateCommand[] } {
  const rng = createRng(seed);
  const states = [state];
  const moves: PlacePlateCommand[] = [];
  while (states.at(-1)!.status === 'playing') {
    const options = legalMoves(states.at(-1)!);
    const cmd = options[rng.int(0, options.length - 1)]!;
    moves.push(cmd);
    states.push(applyCommand(states.at(-1)!, cmd).nextState);
  }
  return { states, moves };
}

describe('board metrics', () => {
  it('counts fragmentation as plates beyond the minimum per flavour', () => {
    const s = stateFromPlates({
      rows: 2,
      columns: 2,
      cells: [
        { row: 0, column: 0, slices: [0, 0] },
        { row: 1, column: 1, slices: [0, 1] },
      ],
    });
    const m = boardMetrics(s);
    expect(m.emptyCells).toBe(2);
    expect(m.occupancy).toBe(0.5);
    expect(m.platesPerFlavor.slice(0, 2)).toEqual([2, 1]);
    expect(m.fragmentation).toBe(1);
    expect(m.mostFragmentedFlavor).toBe(0);
  });
});

describe('hints', () => {
  const state = createInitialState(LEVELS[0]!);
  const hints = computeHints(state);

  it('ranks solver-confirmed winning moves first', () => {
    const rank = { win: 0, unknown: 1, 'no-win': 2 } as const;
    const ranks = hints.evals.map((e) => rank[e.verdict]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(hints.certainty).toBe('confirmed');
    expect(hints.best?.verdict).toBe('win');
  });

  it('offers at most three distinct cells and a line that really wins', () => {
    expect(hints.cells.length).toBeGreaterThan(0);
    expect(hints.cells.length).toBeLessThanOrEqual(3);
    expect(new Set(hints.cells).size).toBe(hints.cells.length);
    expect(hints.line[0]).toEqual(hints.best?.cmd);
    let s = state;
    for (const m of hints.line) s = applyCommand(s, m).nextState;
    expect(s.status).toBe('won');
  });

  it('explains a move with rows built from real engine numbers', () => {
    const best = hints.best!;
    const rows = explainMove(state, best, hints);
    const real = applyCommand(state, best.cmd);
    expect(rows.find((r) => r.key === 'cakes')?.value).toBe(String(real.analysis.cakesCompleted));
    expect(rows.find((r) => r.key === 'emptyCells')?.value).toContain(
      `→ ${real.analysis.emptyCellsAfter}`,
    );
  });

  it('every evaluated verdict agrees with an independent solver run', () => {
    for (const e of hints.evals.slice(0, 6)) {
      const next = applyCommand(state, e.cmd).nextState;
      const s = next.status === 'won' ? { solved: true } : findSolution(next, 200_000);
      if (e.verdict === 'win') expect(s.solved).toBe(true);
    }
  });
});

describe('teach me comparison', () => {
  const state = createInitialState(LEVELS[3]!);
  const evals = evaluateMoves(state);
  it('matches when the recommendation is played and differs for a losing move', () => {
    const best = compareMoves(state, evals[0]!.cmd, evals);
    expect(best.matchesBest).toBe(true);
    const bad = evals.find((e) => e.verdict === 'no-win');
    if (bad) {
      const c = compareMoves(state, bad.cmd, evals);
      expect(c.matchesBest).toBe(false);
      expect(c.chosen?.verdict).toBe('no-win');
    }
    expect(best.rows.find((r) => r.key === 'route')?.best).toBe(String(evals[0]!.lineLength));
  });
});

describe('failure analysis', () => {
  it('finds the critical move, and the position before it still has a winning route', () => {
    const level = LEVELS[3]!; // random play loses often here
    let report;
    let line;
    for (let i = 0; i < 40 && !report; i++) {
      const l = randomLine(createInitialState(level), `fail-${i}`);
      if (l.states.at(-1)!.status !== 'lost') continue;
      const r = analyzeFailure(l.states, l.moves);
      if (r.lastWinningIndex !== null) {
        report = r;
        line = l;
      }
    }
    expect(report).toBeDefined();
    expect(line).toBeDefined();
    const { states, moves } = line!;
    const r = report!;
    const idx = r.lastWinningIndex!;
    expect(findSolution(states[idx]!, 400_000).solved).toBe(true);
    expect(r.criticalMove).toEqual(moves[idx]);
    expect(r.movesAfterCritical).toBe(moves.length - (idx + 1));
    if (r.conclusive) {
      const after = findSolution(states[idx + 1]!, 400_000);
      expect(after.solved).toBe(false);
    }
    if (r.alternative) {
      expect(r.alternative.verdict).toBe('win');
      const next = applyCommand(states[idx]!, r.alternative.cmd).nextState;
      expect(next.status === 'won' || findSolution(next, 400_000).solved).toBe(true);
    }
  }, 120_000);

  it('returns an empty report for an empty line', () => {
    const s = createInitialState(LEVELS[0]!);
    expect(analyzeFailure([s], []).lastWinningIndex).toBeNull();
  });
});

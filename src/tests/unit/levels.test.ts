import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { LEVELS } from '../../content/levels';
import { createInitialState } from '../../game/generation/expand';
import { applyCommand, legalMoves } from '../../game/rules/engine';
import { findSolution } from '../../game/analysis/solver';
import { History, replay } from '../../game/history/history';
import type { GameState, TrayMode } from '../../game/model/types';

const MODES: TrayMode[] = ['slot', 'batch'];

function totalSlices(s: GameState): number {
  let n = 0;
  for (const p of s.board) n += p?.slices.length ?? 0;
  for (const p of s.tray) n += p?.slices.length ?? 0;
  for (let i = s.queueIndex; i < s.queue.length; i++) n += s.queue[i]?.slices.length ?? 0;
  return n + s.completedCakes.reduce((a, b) => a + b, 0) * s.ruleset.cakeSize;
}

describe('level generation', () => {
  for (const level of LEVELS) {
    it(`${level.id} is deterministic, stable and conserves slices`, () => {
      const a = createInitialState(level);
      const b = createInitialState(level);
      expect(a).toEqual(b);
      const expected = level.generation.cakesPerFlavor.reduce((x, y) => x + y, 0) * level.cakeSize;
      expect(totalSlices(a)).toBe(expected);
      // The starting board has no adjacent plates sharing a flavour.
      for (let i = 0; i < a.board.length; i++) {
        const p = a.board[i];
        if (!p) continue;
        for (const nb of [i + 1, i + a.columns]) {
          if (nb === i + 1 && (i + 1) % a.columns === 0) continue;
          const q = a.board[nb];
          if (q) expect(q.slices.some((x) => p.slices.includes(x))).toBe(false);
        }
      }
    });
    for (const mode of MODES) {
      it(`${level.id} is solvable in ${mode} mode`, () => {
        const r = findSolution(createInitialState(level, { trayMode: mode }), 400_000);
        expect(r.solved).toBe(true);
        // Replay the solution with the real engine.
        let s = createInitialState(level, { trayMode: mode });
        for (const m of r.moves) s = applyCommand(s, m).nextState;
        expect(s.status).toBe('won');
      }, 120_000);
    }
  }
});

describe('engine properties', () => {
  const pick = (s: GameState, choice: number) => {
    const moves = legalMoves(s);
    return moves[choice % moves.length];
  };
  for (const mode of MODES) {
    it(`conserves slices, respects capacity, replays and rewinds exactly (${mode})`, () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: LEVELS.length - 1 }),
          fc.array(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 20 }),
          (levelIdx, choices) => {
            const level = LEVELS[levelIdx]!;
            const initial = createInitialState(level, { trayMode: mode });
            const history = new History(initial);
            const total = totalSlices(initial);
            for (const c of choices) {
              const cmd = pick(history.current, c);
              if (!cmd) break;
              history.play(cmd);
              const s = history.current;
              expect(totalSlices(s)).toBe(total);
              for (const p of s.board) {
                if (p) {
                  expect(p.slices.length).toBeGreaterThan(0);
                  expect(p.slices.length).toBeLessThanOrEqual(s.ruleset.cakeSize);
                }
              }
            }
            // Replay reproduces the final state; rewinding restores earlier states exactly.
            expect(replay(initial, history.moves)).toEqual(history.current);
            const n = history.moves.length;
            if (n > 0) {
              const mid = Math.floor(n / 2);
              const expected = replay(initial, history.moves.slice(0, mid));
              expect(history.rewindTo(mid)).toEqual(expected);
              expect(history.restart()).toEqual(initial);
            }
          },
        ),
        { numRuns: 60 },
      );
    });
  }
});

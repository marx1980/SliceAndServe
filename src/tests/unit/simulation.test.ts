import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../content/levels';
import { AGENTS } from '../../game/simulation/agents/agents';
import { playGame, runBatch, summarize } from '../../game/simulation/play';
import { checkBalance } from '../../game/simulation/balance';
import { createInitialState } from '../../game/generation/expand';
import { shortestLine } from '../../game/analysis/solver';
import { applyCommand } from '../../game/rules/engine';

describe('simulation', () => {
  const level = LEVELS[0]!;

  it('is deterministic for a given agent and seed', () => {
    for (const id of Object.keys(AGENTS)) {
      const a = playGame(level, AGENTS[id]!, 7, 'slot');
      const b = playGame(level, AGENTS[id]!, 7, 'slot');
      expect(b).toEqual({ ...a, resolveMs: b.resolveMs });
    }
  });

  it('every agent finishes a game and reports sane metrics', () => {
    for (const id of Object.keys(AGENTS)) {
      const rec = playGame(level, AGENTS[id]!, 1, 'batch');
      expect(rec.moves).toBeGreaterThan(0);
      expect(rec.peakOccupancy).toBeLessThanOrEqual(1);
      expect(rec.won || rec.failureTurn !== null).toBe(true);
    }
  });

  it('summaries include the win-rate interval and balance check reports machine-readable failures', () => {
    const recs = runBatch(level, AGENTS['random']!, 'slot', 0, 20);
    const s = summarize(level.id, 'random', 'slot', recs, 0);
    expect(s.winRateLow).toBeLessThanOrEqual(s.winRate);
    expect(s.winRateHigh).toBeGreaterThanOrEqual(s.winRate);
    const failures = checkBalance(
      [{ ...s, winRate: 0.1, winRateLow: 0.05, winRateHigh: 0.15 }],
      [level.id],
    );
    expect(failures[0]).toMatchObject({ level: 'L01', agent: 'random', metric: 'winRate' });
  });

  it('the solver agent wins every level in both tray modes', () => {
    for (const l of LEVELS)
      for (const mode of ['slot', 'batch'] as const)
        expect(playGame(l, AGENTS['solver']!, 0, mode).won).toBe(true);
  });

  it('shortestLine returns a replayable winning line', () => {
    const s = createInitialState(level, { trayMode: 'slot' });
    const r = shortestLine(s);
    expect(r.proven).toBe(true);
    let t = s;
    for (const m of r.moves) t = applyCommand(t, m).nextState;
    expect(t.status).toBe('won');
  });
});

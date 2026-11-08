import { describe, expect, it } from 'vitest';
import modesJson from '../../content/modes.json';
import { findSolution } from '../../game/analysis/solver';
import { createInitialState } from '../../game/generation/expand';
import {
  DAILY_WINDOW,
  TIER_BY_WEEKDAY,
  dailyFor,
  dailyLevel,
  dayNumber,
  playableDays,
  weekdayOf,
  type DailyEntry,
} from '../../game/modes/daily';
import { endlessLevel, endlessRules, passLevel, zenLevel } from '../../game/modes/generate';
import {
  checkRescue,
  decodeRescue,
  encodeRescue,
  lastRescuableIndex,
  rescueFromState,
} from '../../game/modes/rescue';
import type { LevelDefinition, TrayMode } from '../../game/model/types';
import { History } from '../../game/history/history';
import { migrateProgress } from '../../save/storage';

const modes = modesJson as unknown as {
  daily: DailyEntry[];
  recipes: LevelDefinition[];
  rescue: LevelDefinition[];
};
const both: TrayMode[] = ['slot', 'batch'];

describe('mode content is solver-verified in both tray models', () => {
  it('daily pool covers every tier', () => {
    for (const tier of [1, 2, 3])
      expect(modes.daily.filter((e) => e.tier === tier).length).toBeGreaterThanOrEqual(12);
  });
  it('every daily puzzle has a replayable winning line in both models', () => {
    for (const e of modes.daily) {
      for (const m of both) {
        const r = findSolution(createInitialState(e.level, { trayMode: m }), 60_000);
        expect(r.solved, `${e.level.id} ${m}`).toBe(true);
      }
    }
  }, 120_000);
  it('recipe challenges and rescue boards are fixed layouts and solvable in both models', () => {
    expect(modes.recipes).toHaveLength(12);
    expect(modes.rescue.length).toBeGreaterThanOrEqual(10);
    for (const level of [...modes.recipes, ...modes.rescue]) {
      expect(level.layout).toBeDefined();
      for (const m of both)
        expect(checkRescue(level, m, 60_000), `${level.id} ${m}`).toBe('solvable');
    }
  }, 120_000);
  it('rescue boards start nearly full', () => {
    for (const level of modes.rescue) {
      const s = createInitialState(level);
      const empty = s.board.filter((p, i) => p === null && s.playable[i]).length;
      expect(empty).toBeLessThanOrEqual(4);
    }
  });
});

describe('daily selection', () => {
  it('is deterministic and offline', () => {
    const a = dailyLevel(modes.daily, '2026-11-08');
    const b = dailyLevel(modes.daily, '2026-11-08');
    expect(a).toEqual(b);
    expect(a?.id).toBe('D-2026-11-08');
  });
  it('gives each day of a week its own puzzle and follows the tier schedule', () => {
    const start = '2026-11-08'; // Sunday
    const base = dayNumber(start);
    const ids = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + base + i));
      const key = d.toISOString().slice(0, 10);
      const e = dailyFor(modes.daily, key) as DailyEntry;
      expect(e.tier).toBe(TIER_BY_WEEKDAY[weekdayOf(key)]);
      ids.add(e.level.id);
    }
    expect(ids.size).toBe(7);
  });
  it('keeps missed puzzles playable for a week', () => {
    const days = playableDays('2026-03-01');
    expect(days).toHaveLength(DAILY_WINDOW);
    expect(days[0]).toBe('2026-03-01');
    expect(days[1]).toBe('2026-02-28');
  });
});

describe('endless, zen and pass generation', () => {
  it('is deterministic per seed and stage and grows gradually', () => {
    expect(endlessLevel('abc', 3)).toEqual(endlessLevel('abc', 3));
    expect(endlessLevel('abc', 3)).not.toEqual(endlessLevel('abd', 3));
    expect(endlessRules(1).flavors).toBe(3);
    expect(endlessRules(10).flavors).toBeGreaterThan(endlessRules(1).flavors);
    expect(endlessRules(10).cakes).toBeGreaterThan(endlessRules(1).cakes);
    for (let stage = 1; stage <= 12; stage++) {
      const s = createInitialState(endlessLevel('t', stage));
      expect(s.status).toBe('playing');
    }
  });
  it('zen goals produce playable puzzles', () => {
    for (const goal of ['any', 'distinct', 'flavor'] as const) {
      const level = zenLevel({ goal, amount: 4, flavors: 3, seed: 'z' });
      const s = createInitialState(level);
      expect(s.status).toBe('playing');
      expect(s.orders).toHaveLength(1);
      // Zen has no failure, so it is not solver-guaranteed; it must still not be provably dead at the start.
      const r = findSolution(s, 20_000);
      expect(r.complete && !r.solved).toBe(false);
    }
  }, 60_000);
  it('pass puzzles toggle tools', () => {
    expect(passLevel('p', false).allowedTools ?? []).toHaveLength(0);
    expect(passLevel('p', true).allowedTools).toHaveLength(4);
  });
});

describe('rescue conversion and codes', () => {
  const base = modes.daily[0]!.level;

  function play(): { states: ReturnType<History['statesToCursor']>; h: History } {
    const h = new History(createInitialState(base));
    // Greedy loser: always take the last legal placement until the game ends.
    for (let i = 0; i < 40 && h.current.status === 'playing'; i++) {
      const s = h.current;
      const cells = s.board
        .map((p, idx) => (p === null && s.playable[idx] ? idx : -1))
        .filter((x) => x >= 0);
      const slot = s.tray.findIndex((p) => p !== null);
      const cell = cells[cells.length - 1] as number;
      h.play({ slot, row: Math.floor(cell / s.columns), column: cell % s.columns });
    }
    return { states: h.statesToCursor(), h };
  }

  it('round-trips a Rescue code', () => {
    const level = modes.rescue[0]!;
    const code = encodeRescue(level);
    const back = decodeRescue(code, level.id);
    expect(back).not.toBeNull();
    expect(createInitialState(back as LevelDefinition)).toEqual(createInitialState(level));
  });
  it('rejects malformed codes', () => {
    expect(decodeRescue('nonsense', 'X')).toBeNull();
    expect(decodeRescue('SSR1:@@@', 'X')).toBeNull();
    expect(decodeRescue(`SSR1:${btoa('{"r":99}')}`, 'X')).toBeNull();
  });
  it('converts a failed timeline into a solvable Rescue puzzle', () => {
    const { states } = play();
    const idx = lastRescuableIndex(states, 30_000);
    if (idx === null) return; // every position already lost: nothing to convert
    const level = rescueFromState(states[idx]!, base, 'X1', '1');
    expect(['solvable']).toContain(checkRescue(level, 'slot', 60_000));
    const s0 = createInitialState(level);
    expect(s0.board.filter(Boolean).length).toBe(states[idx]!.board.filter(Boolean).length);
  });
});

describe('progress v3 migration', () => {
  it('upgrades v2 saves and keeps hats', () => {
    const p = migrateProgress({
      schemaVersion: 2,
      levels: { L01: { completed: true, bestMoves: 9, hatMoves: true, hatMastery: false } },
      bakeryStyles: {},
      seenDialogue: [],
      lastLevel: 'L02',
      endingSeen: false,
    });
    expect(p?.schemaVersion).toBe(3);
    expect(p?.levels.L01?.hatMoves).toBe(true);
    expect(p?.modes.results).toEqual({});
    expect(p?.modes.endless.bestStage).toBe(0);
  });
  it('sanitises mode records', () => {
    const p = migrateProgress({
      schemaVersion: 3,
      levels: {},
      modes: {
        results: { a: { completed: true, bestMoves: -4 } },
        endless: { bestStage: 'x' },
        rescues: [1, { id: 'a', code: 'b' }],
      },
    });
    expect(p?.modes.results.a?.bestMoves).toBe(0);
    expect(p?.modes.endless.bestStage).toBe(0);
    expect(p?.modes.rescues).toEqual([{ id: 'a', code: 'b' }]);
  });
});

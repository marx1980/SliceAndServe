import { describe, expect, it } from 'vitest';
import masteryJson from '../../content/mastery.json';
import receiptsJson from '../../content/receipts.json';
import { LEVELS } from '../../content/levels';
import { RECIPES } from '../../content/recipes';
import { BAKERY_AREAS, isRestored } from '../../content/bakery';
import { DIALOGUE } from '../../content/dialogue';
import { levelHash, type Receipt } from '../../game/analysis/receipt';
import { goalMet, masteryMet, playOutcome } from '../../game/progression/mastery';
import type { Command, TrayMode } from '../../game/model/types';

const mastery = masteryJson as unknown as Record<
  string,
  {
    goal: unknown;
    levelHash: number;
    witness: Record<TrayMode, Command[]>;
    best: Record<TrayMode, Command[]>;
  }
>;
const receipts = receiptsJson as Receipt[];

describe('campaign content', () => {
  it('has 30 levels with unique ids in order', () => {
    expect(LEVELS).toHaveLength(30);
    expect(LEVELS.map((l) => l.id)).toEqual(
      LEVELS.map((_, i) => `L${String(i + 1).padStart(2, '0')}`),
    );
  });

  it('gives every level a recipe, and every recipe a level', () => {
    expect(RECIPES).toHaveLength(LEVELS.length);
    for (const r of RECIPES) expect(LEVELS.some((l) => l.id === r.levelId)).toBe(true);
    expect(new Set(RECIPES.map((r) => r.name.en)).size).toBe(RECIPES.length);
  });

  it('restores bakery areas progressively, ending with the last level', () => {
    const at = BAKERY_AREAS.map((a) => a.restoredAt);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(at.at(-1)).toBe(LEVELS.length);
    expect(BAKERY_AREAS.filter((a) => isRestored(a, 0))).toHaveLength(0);
    expect(BAKERY_AREAS.every((a) => isRestored(a, LEVELS.length))).toBe(true);
  });

  it('only references real levels in dialogue and keeps lines short', () => {
    for (const d of DIALOGUE) {
      expect(LEVELS.some((l) => l.id === d.levelId)).toBe(true);
      expect(d.text.en.split(' ').length).toBeLessThanOrEqual(14);
      expect(d.text.hr.length).toBeGreaterThan(0);
    }
  });

  it('allows tools only gradually and never requires them', () => {
    const first = LEVELS.findIndex((l) => (l.allowedTools ?? []).length > 0);
    expect(first).toBeGreaterThanOrEqual(5);
    // Introduced one at a time.
    const counts = LEVELS.map((l) => (l.allowedTools ?? []).length);
    for (let i = 1; i < counts.length; i++)
      expect(counts[i]! - counts[i - 1]!).toBeLessThanOrEqual(1);
  });
});

describe('mastery goals (hat 3)', () => {
  for (const level of LEVELS) {
    for (const mode of ['slot', 'batch'] as TrayMode[]) {
      it(`${level.id} ${mode}: goal is reachable by a stored winning line`, () => {
        const entry = mastery[level.id];
        expect(entry).toBeDefined();
        expect(entry!.levelHash).toBe(levelHash(level));
        expect(level.mastery).toBeDefined();
        const line = entry!.witness[mode];
        expect(masteryMet(level, mode, line)).toBe(true);
        // A line that wins without meeting the goal does not earn the hat.
        const out = playOutcome(level, mode, line);
        expect(goalMet(level.mastery!, out)).toBe(true);
      });

      it(`${level.id} ${mode}: move target is reachable`, () => {
        const best = mastery[level.id]!.best[mode];
        const out = playOutcome(level, mode, best);
        expect(out.won).toBe(true);
        expect(best.length).toBeLessThanOrEqual(level.moveTarget);
        const r = receipts.find((x) => x.levelId === level.id && x.trayMode === mode)!;
        expect(Math.min(best.length, r.shortestLine.length)).toBeLessThanOrEqual(level.moveTarget);
      });
    }
  }
});

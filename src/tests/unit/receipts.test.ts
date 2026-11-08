import { describe, expect, it } from 'vitest';
import receiptsJson from '../../content/receipts.json';
import { LEVELS } from '../../content/levels';
import { createInitialState } from '../../game/generation/expand';
import { applyCommand } from '../../game/rules/engine';
import { receiptStatus, type Receipt } from '../../game/analysis/receipt';
import type { TrayMode } from '../../game/model/types';

const receipts = receiptsJson as Receipt[];

describe('Fair Bake receipts', () => {
  for (const level of LEVELS) {
    for (const mode of ['slot', 'batch'] as TrayMode[]) {
      it(`${level.id} ${mode}: receipt is current and its stored solution wins`, () => {
        const receipt = receipts.find((r) => r.levelId === level.id && r.trayMode === mode);
        expect(receiptStatus(level, receipt)).toBe('verified');
        expect(receipt!.viableFirstMoves).toBeGreaterThanOrEqual(3);
        let s = createInitialState(level, { trayMode: mode });
        for (const m of receipt!.solution) s = applyCommand(s, m).nextState;
        expect(s.status).toBe('won');
        expect(receipt!.shortest).not.toBeNull();
        // The stored shortest line replays to a win and the move target is reachable.
        let t = createInitialState(level, { trayMode: mode });
        for (const m of receipt!.shortestLine) t = applyCommand(t, m).nextState;
        expect(t.status).toBe('won');
        expect(receipt!.shortestLine.length).toBe(receipt!.shortest);
      });
    }
  }
  it('reports an outdated receipt when the level changes', () => {
    const level = LEVELS[0]!;
    const receipt = receipts.find((r) => r.levelId === level.id)!;
    const edited = {
      ...level,
      title: level.title,
      moveTarget: level.moveTarget,
      rows: level.rows + 1,
    };
    expect(receiptStatus(edited, receipt)).toBe('outdated');
    expect(receiptStatus(level, undefined)).toBe('missing');
  });
});

import { describe, expect, it } from 'vitest';
import {
  completedCount,
  defaultProgress,
  hatCount,
  migrateProgress,
  migrateSettings,
  recordWin,
  totalHats,
} from '../../save/storage';
import { History } from '../../game/history/history';
import { LEVELS } from '../../content/levels';
import { createInitialState } from '../../game/generation/expand';
import { legalMoves } from '../../game/rules/engine';

describe('saves', () => {
  it('migrates settings and fills new fields', () => {
    const s = migrateSettings({ schemaVersion: 1, trayMode: 'batch', language: 'hr' });
    expect(s?.schemaVersion).toBe(2);
    expect(s?.trayMode).toBe('batch');
    expect(s?.language).toBe('hr');
    expect(s?.teachMe).toBe(false);
    expect(s?.skipDialogue).toBe(false);
    expect(s?.plateTheme).toBe('classic');
    expect(migrateSettings({ schemaVersion: 99 })).toBeNull();
    expect(migrateSettings('nope')).toBeNull();
  });

  it('progress only improves', () => {
    let p = recordWin(defaultProgress(), 'L01', 9, { moves: false, mastery: false });
    p = recordWin(p, 'L01', 12, { moves: true, mastery: false });
    p = recordWin(p, 'L01', 11, { moves: false, mastery: true });
    expect(p.levels.L01).toEqual({
      completed: true,
      bestMoves: 9,
      hatMoves: true,
      hatMastery: true,
    });
    expect(hatCount(p.levels.L01)).toBe(3);
    expect(completedCount(p)).toBe(1);
    expect(totalHats(p)).toBe(3);
  });

  it('migrates version 1 progress, turning the hat count into separate hats', () => {
    const p = migrateProgress({
      schemaVersion: 1,
      levels: {
        L01: { completed: true, bestMoves: 8, hats: 2 },
        L02: { completed: true, bestMoves: 5, hats: 1 },
      },
    });
    expect(p?.schemaVersion).toBe(2);
    expect(p?.levels.L01).toEqual({
      completed: true,
      bestMoves: 8,
      hatMoves: true,
      hatMastery: false,
    });
    expect(p?.levels.L02?.hatMoves).toBe(false);
    expect(p?.lastLevel).toBe('L01');
    expect(migrateProgress({ schemaVersion: 3, levels: {} })).toBeNull();
  });
});

describe('suspend and resume', () => {
  it('restores the whole timeline, branches and bookmarks by replay', () => {
    const level = LEVELS[3]!;
    const initial = createInitialState(level);
    const h = new History(initial);
    const first = legalMoves(h.current);
    h.play(first[0]!);
    h.play(legalMoves(h.current)[0]!);
    h.toggleBookmark();
    h.undo();
    h.play(legalMoves(h.current)[1]!);
    const saved = JSON.parse(JSON.stringify(h.serialize()));
    const back = History.restore(initial, saved)!;
    expect(back).not.toBeNull();
    expect(back.current).toEqual(h.current);
    expect(back.length).toBe(h.length);
    expect(back.branches()).toEqual(h.branches());
    expect(back.bookmarks().map((n) => n.id)).toEqual(h.bookmarks().map((n) => n.id));
  });

  it('rejects a timeline that does not fit the level', () => {
    const initial = createInitialState(LEVELS[3]!);
    const bad = {
      nodes: [
        { id: 0, parent: null, command: null, bookmark: false, lastChild: null },
        {
          id: 1,
          parent: 0,
          command: { slot: 0, row: 99, column: 99 },
          bookmark: false,
          lastChild: null,
        },
      ],
      cursor: 1,
      leaf: 1,
    };
    expect(History.restore(initial, bad)).toBeNull();
    expect(History.restore(initial, 'nonsense')).toBeNull();
  });
});

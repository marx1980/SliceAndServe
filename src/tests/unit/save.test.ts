import { describe, expect, it } from 'vitest';
import { migrateProgress, migrateSettings, recordWin, defaultProgress } from '../../save/storage';

describe('saves', () => {
  it('migrates settings and fills new fields', () => {
    const s = migrateSettings({ schemaVersion: 1, trayMode: 'batch', language: 'hr' });
    expect(s?.trayMode).toBe('batch');
    expect(s?.language).toBe('hr');
    expect(s?.teachMe).toBe(false);
    expect(migrateSettings({ schemaVersion: 99 })).toBeNull();
    expect(migrateSettings('nope')).toBeNull();
  });
  it('progress only improves', () => {
    let p = recordWin(defaultProgress(), 'L01', 9, 1);
    p = recordWin(p, 'L01', 12, 2);
    p = recordWin(p, 'L01', 11, 1);
    expect(p.levels.L01).toEqual({ completed: true, bestMoves: 9, hats: 2 });
    expect(migrateProgress({ schemaVersion: 1, levels: { A: { hats: 9 } } })?.levels.A?.hats).toBe(
      3,
    );
  });
});

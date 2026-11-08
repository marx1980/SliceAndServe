import { describe, expect, it } from 'vitest';
import { stateFromPlates } from '../../game/generation/expand';
import { applyCommand } from '../../game/rules/engine';
import { applyTool, isToolLegal } from '../../game/rules/tools';
import { applyAny } from '../../game/rules/apply';
import { History } from '../../game/history/history';
import type { GameState } from '../../game/model/types';

const ALL = ['server', 'mitt', 'spoon', 'bin'] as const;

function withTools(s: GameState, tools: Partial<GameState['tools']>): GameState {
  return { ...s, tools: { ...s.tools, ...tools } };
}

describe('earned chef tools', () => {
  it('earns sugar energy only on levels that allow tools', () => {
    const mk = (allowed: boolean) =>
      stateFromPlates({
        rows: 2,
        columns: 3,
        cells: [{ row: 0, column: 0, slices: [0, 0, 0, 0, 0] }],
        tray: [[0], [1], [1]],
        queue: [[1]],
        allowedTools: allowed ? [...ALL] : [],
      });
    const place = { slot: 0, row: 0, column: 1 };
    expect(applyCommand(mk(true), place).nextState.energy).toBe(1);
    expect(applyCommand(mk(false), place).nextState.energy).toBe(0);
  });

  it('grants a tool at six energy and lets the player choose it', () => {
    let s = stateFromPlates({
      rows: 2,
      columns: 3,
      cells: [{ row: 0, column: 0, slices: [0] }],
      tray: [[1], [1], [1]],
      allowedTools: [...ALL],
    });
    s = { ...s, energy: 5 };
    s = { ...s, energy: 6 % 6, grants: 1 };
    expect(isToolLegal(s, { tool: 'grant', choose: 'bin' })).toBe(true);
    const r = applyTool(s, { tool: 'grant', choose: 'bin' });
    expect(r.nextState.tools.bin).toBe(1);
    expect(r.nextState.grants).toBe(0);
    expect(r.nextState.moveNumber).toBe(s.moveNumber);
  });

  it('cake server moves one slice and settles, completing a cake', () => {
    const s = withTools(
      stateFromPlates({
        rows: 2,
        columns: 3,
        cells: [
          { row: 0, column: 0, slices: [0, 0, 0, 0, 0] },
          { row: 0, column: 2, slices: [0, 1] },
        ],
        tray: [[1], [1], [1]],
        allowedTools: [...ALL],
      }),
      { server: 1 },
    );
    // Not adjacent: illegal.
    expect(isToolLegal(s, { tool: 'server', from: 2, to: 0, flavor: 0 })).toBe(false);
    const moved = applyAny(
      withTools(
        stateFromPlates({
          rows: 2,
          columns: 3,
          cells: [
            { row: 0, column: 0, slices: [0, 0, 0, 0, 0] },
            { row: 0, column: 1, slices: [0, 1] },
          ],
          tray: [[1], [1], [1]],
          allowedTools: [...ALL],
        }),
        { server: 1 },
      ),
      { tool: 'server', from: 1, to: 0, flavor: 0 },
    );
    expect(moved.nextState.completedCakes[0]).toBe(1);
    expect(moved.nextState.tools.server).toBe(0);
    expect(moved.nextState.moveNumber).toBe(1);
  });

  it('oven mitt relocates a plate to a free cell', () => {
    const s = withTools(
      stateFromPlates({
        rows: 2,
        columns: 3,
        cells: [{ row: 0, column: 0, slices: [2, 2] }],
        tray: [[1], [1], [1]],
        allowedTools: [...ALL],
      }),
      { mitt: 1 },
    );
    const r = applyTool(s, { tool: 'mitt', from: 0, to: 5 });
    expect(r.nextState.board[0]).toBeNull();
    expect(r.nextState.board[5]?.slices).toEqual([2, 2]);
    expect(() => applyTool(s, { tool: 'mitt', from: 0, to: 0 })).toThrow();
  });

  it('tasting spoon reveals upcoming plates; bin discards a tray plate and refills', () => {
    let s = withTools(
      stateFromPlates({
        rows: 2,
        columns: 3,
        cells: [],
        tray: [[0], [1], [2]],
        queue: [[3], [3], [3], [3]],
        allowedTools: [...ALL],
      }),
      { spoon: 1, bin: 1 },
    );
    s = applyTool(s, { tool: 'spoon' }).nextState;
    expect(s.revealed).toBe(3);
    const b = applyTool(s, { tool: 'bin', slot: 0 }).nextState;
    expect(b.tray[0]?.slices).toEqual([3]);
    expect(b.queueIndex).toBe(1);
    expect(b.moveNumber).toBe(0);
  });

  it('tool actions live in the timeline: undo restores the inventory, replay is exact', () => {
    const s = withTools(
      stateFromPlates({
        rows: 2,
        columns: 3,
        cells: [{ row: 0, column: 0, slices: [2, 2] }],
        tray: [[1], [1], [1]],
        allowedTools: [...ALL],
      }),
      { mitt: 1 },
    );
    const h = new History(s);
    h.play({ tool: 'mitt', from: 0, to: 4 });
    expect(h.current.tools.mitt).toBe(0);
    h.undo();
    expect(h.current.tools.mitt).toBe(1);
    h.redo();
    let replay = s;
    for (const c of h.moves) replay = applyAny(replay, c).nextState;
    expect(replay).toEqual(h.current);
  });
});

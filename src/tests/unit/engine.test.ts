import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  IllegalMoveError,
  isLegal,
  legalMoves,
  pickDestination,
  previewMove,
} from '../../game/rules/engine';
import { stateFromPlates } from '../../game/generation/expand';
import type { GameState } from '../../game/model/types';

const slices = (s: GameState, row: number, col: number): readonly number[] | null =>
  s.board[row * s.columns + col]?.slices ?? null;

describe('placement', () => {
  const base = stateFromPlates({
    rows: 2,
    columns: 2,
    cells: [{ row: 0, column: 0, slices: [0] }],
    tray: [[1], [2]],
    mask: [true, true, true, false],
  });
  it('rejects occupied, blocked, out-of-range and empty-slot placements', () => {
    expect(isLegal(base, { slot: 0, row: 0, column: 0 })).toBe(false);
    expect(isLegal(base, { slot: 0, row: 1, column: 1 })).toBe(false);
    expect(isLegal(base, { slot: 0, row: 2, column: 0 })).toBe(false);
    expect(isLegal(base, { slot: 2, row: 0, column: 1 })).toBe(false);
    expect(isLegal(base, { slot: 0, row: 0, column: 1 })).toBe(true);
    expect(() => applyCommand(base, { slot: 0, row: 0, column: 0 })).toThrow(IllegalMoveError);
  });
  it('lists legal moves as tray plates times empty playable cells', () => {
    expect(legalMoves(base)).toHaveLength(2 * 2);
  });
  it('does not mutate the previous state', () => {
    const before = JSON.stringify(base);
    applyCommand(base, { slot: 0, row: 0, column: 1 });
    expect(JSON.stringify(base)).toBe(before);
  });
});

describe('transfers', () => {
  it('moves slices toward the larger group and clears the emptied plate', () => {
    const s = stateFromPlates({
      rows: 1,
      columns: 3,
      cells: [{ row: 0, column: 0, slices: [0, 0, 1] }],
      tray: [[0]],
    });
    const r = applyCommand(s, { slot: 0, row: 0, column: 1 });
    expect(slices(r.nextState, 0, 0)).toEqual([0, 0, 0, 1]);
    expect(slices(r.nextState, 0, 1)).toBeNull();
    expect(r.analysis.transfers).toBe(1);
    expect(r.analysis.spacesFreed).toBe(1);
  });
  it('prefers the active plate on equal groups', () => {
    const s = stateFromPlates({
      rows: 1,
      columns: 3,
      cells: [{ row: 0, column: 0, slices: [0, 0, 1] }],
      tray: [[0, 0, 2]],
    });
    const r = applyCommand(s, { slot: 0, row: 0, column: 1 });
    expect(slices(r.nextState, 0, 1)).toEqual([0, 0, 0, 0, 2]);
    expect(slices(r.nextState, 0, 0)).toEqual([1]);
  });
  it('respects capacity, including partial transfers', () => {
    const full = stateFromPlates({
      rows: 1,
      columns: 3,
      cells: [{ row: 0, column: 0, slices: [0, 0, 0, 0, 1, 1] }],
      tray: [[0, 0]],
    });
    const blocked = applyCommand(full, { slot: 0, row: 0, column: 1 });
    expect(slices(blocked.nextState, 0, 0)).toEqual([0, 0, 0, 0, 1, 1]);
    expect(slices(blocked.nextState, 0, 1)).toEqual([0, 0]);
    expect(blocked.analysis.transfers).toBe(0);

    const partial = stateFromPlates({
      rows: 1,
      columns: 3,
      cells: [{ row: 0, column: 0, slices: [0, 0, 0, 1, 1] }],
      tray: [[0, 0, 2]],
    });
    const r = applyCommand(partial, { slot: 0, row: 0, column: 1 });
    expect(slices(r.nextState, 0, 0)).toEqual([0, 0, 0, 0, 1, 1]);
    expect(slices(r.nextState, 0, 1)).toEqual([0, 2]);
  });
  it('uses shared flavours in flavour order and neighbour order top, right, bottom, left', () => {
    // Placed plate at (1,1) with neighbours top (0,1) and left (1,0), both larger groups.
    const s = stateFromPlates({
      rows: 3,
      columns: 3,
      cells: [
        { row: 0, column: 1, slices: [0, 0] },
        { row: 1, column: 0, slices: [0, 0, 0] },
      ],
      tray: [[0]],
    });
    const r = applyCommand(s, { slot: 0, row: 1, column: 1 });
    const first = r.events.find((e) => e.type === 'transfer');
    expect(first).toMatchObject({ toCell: 1 }); // top neighbour is served first
  });
  it('breaks ties by active plate, then by lower cell', () => {
    expect(pickDestination(4, 5, 2, 2, 5)).toBe(5);
    expect(pickDestination(4, 5, 2, 2, 4)).toBe(4);
    expect(pickDestination(4, 5, 2, 2, -1)).toBe(4);
    expect(pickDestination(7, 3, 2, 2, -1)).toBe(3);
    expect(pickDestination(4, 5, 3, 2, 5)).toBe(4);
  });
});

describe('completion and chains', () => {
  it('completes a six-slice single-flavour cake and removes it', () => {
    const s = stateFromPlates({
      rows: 1,
      columns: 3,
      cells: [{ row: 0, column: 0, slices: [0, 0, 0, 0, 0] }],
      tray: [[0]],
    });
    const r = applyCommand(s, { slot: 0, row: 0, column: 1 });
    expect(r.nextState.board.every((p) => p === null)).toBe(true);
    expect(r.nextState.completedCakes[0]).toBe(1);
    expect(r.analysis.chainDepth).toBe(1);
    expect(r.nextState.score).toBe(100);
  });
  it('completes several cakes in the same round simultaneously', () => {
    const s = stateFromPlates({
      rows: 3,
      columns: 1,
      cells: [
        { row: 0, column: 0, slices: [0, 0, 0, 0, 0] },
        { row: 2, column: 0, slices: [1, 1, 1, 1, 1] },
      ],
      tray: [[0, 1]],
    });
    const r = applyCommand(s, { slot: 0, row: 1, column: 0 });
    expect(r.analysis.cakesCompleted).toBe(2);
    expect(r.analysis.chainDepth).toBe(1);
  });
  it('produces a chain when a transfer frees capacity for a later completion', () => {
    // Row: T=[1] | S=[0,1,1,1,1,1] | P placed=[0,0,0,0,0].
    // Round 1: P takes S's 0 and completes. S now has space, so round 2: S takes T's 1 and completes.
    const s = stateFromPlates({
      rows: 1,
      columns: 4,
      cells: [
        { row: 0, column: 0, slices: [1] },
        { row: 0, column: 1, slices: [0, 1, 1, 1, 1, 1] },
      ],
      tray: [[0, 0, 0, 0, 0]],
    });
    const r = applyCommand(s, { slot: 0, row: 0, column: 2 });
    expect(r.analysis.chainDepth).toBe(2);
    expect(r.analysis.cakesCompleted).toBe(2);
    expect(r.nextState.board.every((p) => p === null)).toBe(true);
    expect(r.nextState.score).toBe(100 + 200);
    const depths = r.events.filter((e) => e.type === 'cake-complete').map((e) => e.depth);
    expect(depths).toEqual([1, 2]);
  });
});

describe('orders and status', () => {
  it('wins when all mandatory orders are complete', () => {
    const s = stateFromPlates({
      rows: 1,
      columns: 3,
      cells: [{ row: 0, column: 0, slices: [0, 0, 0, 0, 0] }],
      tray: [[0]],
      orders: [{ kind: 'complete-flavor', flavor: 0, count: 1 }],
    });
    const r = applyCommand(s, { slot: 0, row: 0, column: 1 });
    expect(r.nextState.status).toBe('won');
    expect(r.analysis.ordersCompleted).toBe(1);
    expect(legalMoves(r.nextState)).toEqual([]);
  });
  it('tracks distinct-flavour and chain orders', () => {
    const s = stateFromPlates({
      rows: 1,
      columns: 4,
      cells: [
        { row: 0, column: 0, slices: [1] },
        { row: 0, column: 1, slices: [0, 1, 1, 1, 1, 1] },
      ],
      tray: [[0, 0, 0, 0, 0]],
      orders: [
        { kind: 'complete-distinct', count: 2 },
        { kind: 'chain', depth: 2 },
      ],
    });
    const r = applyCommand(s, { slot: 0, row: 0, column: 2 });
    expect(r.nextState.orderProgress.map((o) => o.complete)).toEqual([true, true]);
    expect(r.nextState.status).toBe('won');
  });
  it('loses on a full board with no applicable action', () => {
    const s = stateFromPlates({
      rows: 1,
      columns: 2,
      cells: [{ row: 0, column: 0, slices: [0] }],
      tray: [[1], [2]],
    });
    const r = applyCommand(s, { slot: 0, row: 0, column: 1 });
    expect(r.nextState.status).toBe('lost');
  });
  it('loses when the tray and queue are exhausted with orders incomplete', () => {
    const s = stateFromPlates({
      rows: 1,
      columns: 4,
      cells: [],
      tray: [[1]],
    });
    const r = applyCommand(s, { slot: 0, row: 0, column: 0 });
    expect(r.nextState.status).toBe('lost');
  });
});

describe('tray models', () => {
  const mk = (trayMode: 'slot' | 'batch'): GameState =>
    stateFromPlates({
      rows: 3,
      columns: 3,
      cells: [],
      tray: [[0], [1], [2]],
      queue: [[0], [1], [2], [3]],
      trayMode,
    });
  const withQueueIndex = (s: GameState): GameState => ({ ...s, queueIndex: 0 });
  it('slot mode refills only the used slot', () => {
    const r = applyCommand(withQueueIndex(mk('slot')), { slot: 1, row: 0, column: 0 });
    expect(r.nextState.tray.map((p) => p?.id)).toEqual(['t0', 'q0', 't2']);
    expect(r.nextState.queueIndex).toBe(1);
  });
  it('batch mode refills all slots only when the tray is empty', () => {
    let s = withQueueIndex(mk('batch'));
    s = applyCommand(s, { slot: 0, row: 0, column: 0 }).nextState;
    s = applyCommand(s, { slot: 1, row: 0, column: 1 }).nextState;
    expect(s.tray.map((p) => p?.id ?? null)).toEqual([null, null, 't2']);
    s = applyCommand(s, { slot: 2, row: 0, column: 2 }).nextState;
    expect(s.tray.map((p) => p?.id ?? null)).toEqual(['q0', 'q1', 'q2']);
    expect(s.queueIndex).toBe(3);
  });
  it('both models consume the queue in the same fixed order', () => {
    for (const mode of ['slot', 'batch'] as const) {
      let s = withQueueIndex(mk(mode));
      const entered: string[] = [];
      for (let i = 0; i < 7; i++) {
        const move = legalMoves(s)[0];
        if (!move) break;
        const before = new Set(s.tray.map((p) => p?.id));
        s = applyCommand(s, move).nextState;
        for (const p of s.tray) if (p && !before.has(p.id)) entered.push(p.id);
        if (s.status !== 'playing') break;
      }
      expect(entered).toEqual(['q0', 'q1', 'q2', 'q3'].slice(0, entered.length));
      expect(entered.length).toBeGreaterThan(0);
    }
  });
});

describe('preview', () => {
  it('matches the real move and returns null for illegal moves', () => {
    const s = stateFromPlates({
      rows: 1,
      columns: 3,
      cells: [{ row: 0, column: 0, slices: [0, 0, 1] }],
      tray: [[0]],
    });
    const cmd = { slot: 0, row: 0, column: 1 };
    expect(previewMove(s, cmd)).toEqual(applyCommand(s, cmd));
    expect(previewMove(s, { slot: 0, row: 0, column: 0 })).toBeNull();
  });
});

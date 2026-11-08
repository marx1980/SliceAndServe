import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../content/levels';
import { createInitialState } from '../../game/generation/expand';
import { legalMoves } from '../../game/rules/engine';
import { History, replay } from '../../game/history/history';

const fresh = () => new History(createInitialState(LEVELS[0]!));

describe('history tree', () => {
  it('undo, redo and scrub restore exact states', () => {
    const h = fresh();
    const initial = h.current;
    h.play(legalMoves(h.current)[0]!);
    h.play(legalMoves(h.current)[0]!);
    h.play(legalMoves(h.current)[0]!);
    const end = h.current;
    expect(h.length).toBe(4);
    h.undo();
    expect(h.position).toBe(2);
    expect(h.canRedo()).toBe(true);
    h.redo();
    expect(h.current).toEqual(end);
    expect(h.rewindTo(1)).toEqual(replay(initial, h.moves));
    expect(h.length).toBe(4); // scrubbing never shortens the branch
    expect(h.restart()).toEqual(initial);
  });

  it('branches from an earlier state without losing the old branch', () => {
    const h = fresh();
    const first = legalMoves(h.current)[0]!;
    h.play(first);
    const afterFirst = h.current;
    const a = legalMoves(h.current)[0]!;
    h.play(a);
    const leafA = h.cursorId;
    h.undo();
    const b = legalMoves(h.current).find((m) => m.row !== a.row || m.column !== a.column)!;
    h.play(b);
    expect(h.branches()).toHaveLength(2);
    expect(h.current).not.toEqual(h.pathTo(leafA).at(-1)!.state);
    expect(h.pathTo(h.cursorId)[1]!.state).toEqual(afterFirst);
    h.switchBranch(leafA);
    expect(h.cursorId).toBe(leafA);
    expect(h.branches().find((x) => x.id === leafA)!.active).toBe(true);
    // Replaying the same move from the same state reuses the node instead of duplicating it.
    h.undo();
    h.play(a);
    expect(h.cursorId).toBe(leafA);
    expect(h.branches()).toHaveLength(2);
  });

  it('bookmarks survive undo and can be jumped to', () => {
    const h = fresh();
    h.play(legalMoves(h.current)[0]!);
    const mark = h.cursorId;
    h.toggleBookmark();
    h.play(legalMoves(h.current)[0]!);
    h.restart();
    expect(h.bookmarks().map((n) => n.id)).toEqual([mark]);
    h.goToNode(mark);
    expect(h.position).toBe(1);
    expect(h.toggleBookmark()).toBe(false);
    expect(h.bookmarks()).toHaveLength(0);
  });
});

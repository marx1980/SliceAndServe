import { applyAny, sameCommand } from '../rules/apply';
import type { Command, EngineResult, GameState } from '../model/types';

export interface HistoryNode {
  readonly id: number;
  readonly parent: number | null;
  readonly command: Command | null;
  readonly state: GameState;
  readonly depth: number;
  readonly children: number[];
  bookmark: boolean;
  /** Most recently visited child, used to continue along a branch. */
  lastChild: number | null;
}

export interface BranchInfo {
  /** Leaf node id; pass to `switchBranch`. */
  id: number;
  moves: number;
  status: GameState['status'];
  active: boolean;
}

/**
 * Timeline tree of stable states. Nothing is ever discarded: undo and scrubbing move a cursor,
 * playing a different move from an earlier state starts a new branch, and every branch can be
 * returned to. Any state is exactly reproducible by replaying the commands on the path to it.
 */
export class History {
  private readonly nodes: HistoryNode[] = [];
  private cursor = 0;
  private leaf = 0;

  constructor(initial: GameState) {
    this.nodes.push({
      id: 0,
      parent: null,
      command: null,
      state: initial,
      depth: 0,
      children: [],
      bookmark: false,
      lastChild: null,
    });
  }

  private node(id: number): HistoryNode {
    return this.nodes[id] as HistoryNode;
  }

  get current(): GameState {
    return this.node(this.cursor).state;
  }

  get initial(): GameState {
    return this.node(0).state;
  }

  get cursorId(): number {
    return this.cursor;
  }

  /** Position of the cursor along the active branch (0 is the start). */
  get position(): number {
    return this.node(this.cursor).depth;
  }

  /** Number of states on the active branch, start included. */
  get length(): number {
    return this.node(this.leaf).depth + 1;
  }

  /** Commands from the start to the cursor. */
  get moves(): readonly Command[] {
    return this.pathTo(this.cursor)
      .slice(1)
      .map((n) => n.command as Command);
  }

  pathTo(id: number): HistoryNode[] {
    const out: HistoryNode[] = [];
    for (
      let n: HistoryNode | null = this.node(id);
      n;
      n = n.parent === null ? null : this.node(n.parent)
    ) {
      out.push(n);
    }
    return out.reverse();
  }

  /** The active branch from the start to its leaf. */
  activePath(): HistoryNode[] {
    return this.pathTo(this.leaf);
  }

  /** States from the start to the cursor, for analysis. */
  statesToCursor(): GameState[] {
    return this.pathTo(this.cursor).map((n) => n.state);
  }

  private descend(id: number): number {
    let n = this.node(id);
    while (n.lastChild !== null) n = this.node(n.lastChild);
    return n.id;
  }

  play(cmd: Command): EngineResult {
    const here = this.node(this.cursor);
    const result = applyAny(here.state, cmd);
    const existing = here.children.find((c) => sameCommand(this.node(c).command as Command, cmd));
    let id: number;
    if (existing !== undefined) {
      id = existing;
    } else {
      id = this.nodes.length;
      this.nodes.push({
        id,
        parent: here.id,
        command: cmd,
        state: result.nextState,
        depth: here.depth + 1,
        children: [],
        bookmark: false,
        lastChild: null,
      });
      here.children.push(id);
    }
    here.lastChild = id;
    this.cursor = id;
    this.leaf = this.descend(id);
    return result;
  }

  canUndo(): boolean {
    return this.node(this.cursor).parent !== null;
  }

  canRedo(): boolean {
    return this.cursor !== this.leaf && this.onActivePath(this.cursor);
  }

  private onActivePath(id: number): boolean {
    return this.activePath().some((n) => n.id === id);
  }

  undo(): GameState {
    const parent = this.node(this.cursor).parent;
    if (parent !== null) {
      this.node(parent).lastChild = this.cursor;
      this.cursor = parent;
    }
    return this.current;
  }

  redo(): GameState {
    if (this.canRedo()) {
      const next = this.activePath()[this.position + 1];
      if (next) this.cursor = next.id;
    }
    return this.current;
  }

  /** Move the cursor to the state after `index` moves along the active branch. */
  rewindTo(index: number): GameState {
    const path = this.activePath();
    const target = path[Math.max(0, Math.min(index, path.length - 1))] as HistoryNode;
    this.cursor = target.id;
    return this.current;
  }

  /** Go to the start; the whole timeline stays available. */
  restart(): GameState {
    return this.rewindTo(0);
  }

  /** Jump to any node (for example a bookmark), adopting its branch. */
  goToNode(id: number): GameState {
    if (!this.onActivePath(id)) this.leaf = this.descend(id);
    this.cursor = id;
    return this.current;
  }

  toggleBookmark(id: number = this.cursor): boolean {
    const n = this.node(id);
    n.bookmark = !n.bookmark;
    return n.bookmark;
  }

  bookmarks(): HistoryNode[] {
    return this.nodes.filter((n) => n.bookmark).sort((a, b) => a.depth - b.depth || a.id - b.id);
  }

  branches(): BranchInfo[] {
    return this.nodes
      .filter((n) => n.children.length === 0)
      .map((n) => ({
        id: n.id,
        moves: n.depth,
        status: n.state.status,
        active: n.id === this.leaf,
      }));
  }

  /** Make a branch active and move the cursor to its end. */
  switchBranch(leafId: number): GameState {
    this.leaf = leafId;
    this.cursor = leafId;
    for (const n of this.pathTo(leafId)) {
      if (n.parent !== null) this.node(n.parent).lastChild = n.id;
    }
    return this.current;
  }
}

/** Replays commands from an initial state; used by tests and saves. */
export function replay(initial: GameState, commands: readonly Command[]): GameState {
  let state = initial;
  for (const cmd of commands) state = applyAny(state, cmd).nextState;
  return state;
}

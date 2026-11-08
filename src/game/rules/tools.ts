import type {
  GameEvent,
  GameState,
  Plate,
  ToolCommand,
  ToolId,
  EngineResult,
} from '../model/types';
import { IllegalMoveError, neighborCells, settle, type WorkPlate } from './engine';

const EMPTY_ANALYSIS = {
  cakesCompleted: 0,
  chainDepth: 0,
  transfers: 0,
  spacesFreed: 0,
  interactingCells: [] as number[],
  ordersCompleted: 0,
};

function emptyCount(state: GameState): number {
  let n = 0;
  for (let i = 0; i < state.board.length; i++) if (state.playable[i] && !state.board[i]) n++;
  return n;
}

function workBoard(state: GameState): (WorkPlate | null)[] {
  return state.board.map((p) => (p ? { id: p.id, slices: p.slices.slice() } : null));
}

/** Returns the reason a tool command is illegal, or null when it can be played. */
export function toolProblem(state: GameState, cmd: ToolCommand): string | null {
  if (state.status !== 'playing') return 'game over';
  if (cmd.tool === 'grant') {
    if (state.grants <= 0) return 'no earned tool';
    return state.allowedTools.includes(cmd.choose) ? null : 'tool not allowed';
  }
  if (!state.allowedTools.includes(cmd.tool)) return 'tool not allowed';
  if (state.tools[cmd.tool] <= 0) return 'tool not owned';
  switch (cmd.tool) {
    case 'server': {
      const a = state.board[cmd.from];
      const b = state.board[cmd.to];
      if (!a || !b || cmd.from === cmd.to) return 'need two plates';
      if (!neighborCells(state, cmd.from).includes(cmd.to)) return 'plates not adjacent';
      if (!a.slices.includes(cmd.flavor)) return 'no such slice';
      if (b.slices.length >= state.ruleset.cakeSize) return 'destination full';
      return null;
    }
    case 'mitt': {
      if (!state.board[cmd.from]) return 'no plate';
      if (!state.playable[cmd.to] || state.board[cmd.to]) return 'cell not free';
      return null;
    }
    case 'spoon':
      return state.revealed >= state.queue.length ? 'nothing to reveal' : null;
    case 'bin':
      return state.tray[cmd.slot] ? null : 'no plate in slot';
  }
}

export function isToolLegal(state: GameState, cmd: ToolCommand): boolean {
  return toolProblem(state, cmd) === null;
}

/** Plain-board tool actions the player can use right now, for UI affordances. */
export function usableTools(state: GameState): ToolId[] {
  return state.allowedTools.filter((t) => state.tools[t] > 0);
}

const spend = (state: GameState, tool: ToolId): GameState['tools'] => ({
  ...state.tools,
  [tool]: state.tools[tool] - 1,
});

/** Applies an earned-tool action with the same purity guarantees as `applyCommand`. */
export function applyTool(state: GameState, cmd: ToolCommand): EngineResult {
  const problem = toolProblem(state, cmd);
  if (problem) throw new IllegalMoveError(`Illegal tool use: ${problem}`);
  const events: GameEvent[] = [{ type: 'tool', tool: cmd.tool }];

  if (cmd.tool === 'grant') {
    const nextState: GameState = {
      ...state,
      grants: state.grants - 1,
      tools: { ...state.tools, [cmd.choose]: state.tools[cmd.choose] + 1 },
    };
    return {
      previousState: state,
      nextState,
      events,
      analysis: { ...EMPTY_ANALYSIS, emptyCellsAfter: emptyCount(state) },
    };
  }

  const tools = spend(state, cmd.tool);
  const base: GameState = { ...state, tools };

  if (cmd.tool === 'spoon') {
    const nextState: GameState = {
      ...base,
      revealed: Math.min(state.queue.length, state.queueIndex + 3),
    };
    return {
      previousState: state,
      nextState,
      events,
      analysis: { ...EMPTY_ANALYSIS, emptyCellsAfter: emptyCount(state) },
    };
  }

  if (cmd.tool === 'bin') {
    const tray: (Plate | null)[] = state.tray.slice();
    let queueIndex = state.queueIndex;
    if (state.ruleset.trayMode === 'slot') {
      const next = state.queue[queueIndex] ?? null;
      tray[cmd.slot] = next;
      if (next) queueIndex++;
    } else {
      tray[cmd.slot] = null;
      if (!tray.some((p) => p !== null) && queueIndex < state.queue.length) {
        for (let s = 0; s < tray.length && queueIndex < state.queue.length; s++) {
          tray[s] = state.queue[queueIndex++] as Plate;
        }
      }
    }
    const lost = !tray.some((p) => p !== null);
    const status = lost ? 'lost' : 'playing';
    if (lost) events.push({ type: 'status', status });
    return {
      previousState: state,
      nextState: { ...base, tray, queueIndex, status },
      events,
      analysis: { ...EMPTY_ANALYSIS, emptyCellsAfter: emptyCount(state) },
    };
  }

  const board = workBoard(state);
  if (cmd.tool === 'server') {
    const src = board[cmd.from] as WorkPlate;
    const dst = board[cmd.to] as WorkPlate;
    src.slices.splice(src.slices.indexOf(cmd.flavor), 1);
    dst.slices.push(cmd.flavor);
    dst.slices.sort((x, y) => x - y);
    if (src.slices.length === 0) board[cmd.from] = null;
    return settle(base, board, state.tray.slice(), state.queueIndex, cmd.to, events, 1);
  }
  // Oven mitt: move a plate to a free cell and let it settle there.
  board[cmd.to] = board[cmd.from] ?? null;
  board[cmd.from] = null;
  return settle(base, board, state.tray.slice(), state.queueIndex, cmd.to, events, 1);
}

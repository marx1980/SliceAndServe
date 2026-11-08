import type {
  EngineResult,
  GameEvent,
  GameState,
  GameStatus,
  MoveAnalysis,
  OrderProgress,
  OrderSpec,
  Plate,
  PlacePlateCommand,
} from '../model/types';

/** Mutable working plate used only inside a single resolution. */
export interface WorkPlate {
  id: string;
  slices: number[];
}

export class IllegalMoveError extends Error {}

/** Sugar energy needed for one earned tool. */
export const ENERGY_PER_TOOL = 6;

const ORTHOGONAL: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];
const WITH_DIAGONALS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
];

/** Neighbour cell indices in rule order (top, right, bottom, left; optionally with diagonals). */
export function neighborCells(state: GameState, cell: number): number[] {
  const { rows, columns, playable } = state;
  const r = Math.floor(cell / columns);
  const c = cell % columns;
  const dirs = state.ruleset.diagonal ? WITH_DIAGONALS : ORTHOGONAL;
  const out: number[] = [];
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= columns) continue;
    const idx = nr * columns + nc;
    if (playable[idx]) out.push(idx);
  }
  return out;
}

export function cellIndex(state: GameState, row: number, column: number): number {
  return row * state.columns + column;
}

export function emptyCells(state: GameState): number[] {
  const out: number[] = [];
  for (let i = 0; i < state.board.length; i++) {
    if (state.playable[i] && state.board[i] === null) out.push(i);
  }
  return out;
}

export function legalMoves(state: GameState): PlacePlateCommand[] {
  if (state.status !== 'playing') return [];
  const empties = emptyCells(state);
  const moves: PlacePlateCommand[] = [];
  for (let slot = 0; slot < state.tray.length; slot++) {
    if (state.tray[slot] === null) continue;
    for (const cell of empties) {
      moves.push({ slot, row: Math.floor(cell / state.columns), column: cell % state.columns });
    }
  }
  return moves;
}

export function isLegal(state: GameState, cmd: PlacePlateCommand): boolean {
  if (state.status !== 'playing') return false;
  if (!Number.isInteger(cmd.slot) || cmd.slot < 0 || cmd.slot >= state.tray.length) return false;
  if (state.tray[cmd.slot] === null) return false;
  if (cmd.row < 0 || cmd.column < 0 || cmd.row >= state.rows || cmd.column >= state.columns) {
    return false;
  }
  const idx = cellIndex(state, cmd.row, cmd.column);
  return state.playable[idx] === true && state.board[idx] === null;
}

function count(plate: WorkPlate, flavor: number): number {
  let n = 0;
  for (const s of plate.slices) if (s === flavor) n++;
  return n;
}

/**
 * Pair list in rule order: active plate pairs first, then other adjacent pairs that include a
 * "hot" plate (one that changed in the previous round), ordered by lower cell.
 */
function candidatePairs(
  state: GameState,
  board: (WorkPlate | null)[],
  activeCell: number,
  hot: ReadonlySet<number>,
): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  const seen = new Set<number>();
  const key = (a: number, b: number): number => Math.min(a, b) * 4096 + Math.max(a, b);
  if (activeCell >= 0 && board[activeCell]) {
    for (const nb of neighborCells(state, activeCell)) {
      if (!board[nb]) continue;
      seen.add(key(activeCell, nb));
      pairs.push([activeCell, nb]);
    }
  }
  for (let i = 0; i < board.length; i++) {
    if (!board[i]) continue;
    for (const nb of neighborCells(state, i)) {
      if (nb < i || !board[nb]) continue;
      if (!hot.has(i) && !hot.has(nb)) continue;
      const k = key(i, nb);
      if (seen.has(k)) continue;
      seen.add(k);
      pairs.push([i, nb]);
    }
  }
  return pairs;
}

interface Transfer {
  from: number;
  to: number;
  flavor: number;
  count: number;
}

/** Destination of a shared flavour: larger group; tie to the active plate; else the lower cell. */
export function pickDestination(
  a: number,
  b: number,
  countA: number,
  countB: number,
  activeCell: number,
): number {
  if (countA > countB) return a;
  if (countB > countA) return b;
  if (a === activeCell) return a;
  if (b === activeCell) return b;
  return Math.min(a, b);
}

function findTransfer(
  state: GameState,
  board: (WorkPlate | null)[],
  activeCell: number,
  hot: ReadonlySet<number>,
): Transfer | null {
  const cap = state.ruleset.cakeSize;
  for (const [a, b] of candidatePairs(state, board, activeCell, hot)) {
    const pa = board[a] as WorkPlate;
    const pb = board[b] as WorkPlate;
    for (let f = 0; f < state.flavorCount; f++) {
      const ca = count(pa, f);
      const cb = count(pb, f);
      if (ca === 0 || cb === 0) continue;
      const to = pickDestination(a, b, ca, cb, activeCell);
      const from = to === a ? b : a;
      const src = board[from] as WorkPlate;
      const dst = board[to] as WorkPlate;
      const k = Math.min(count(src, f), cap - dst.slices.length);
      if (k > 0) return { from, to, flavor: f, count: k };
    }
  }
  return null;
}

function applyTransfer(board: (WorkPlate | null)[], t: Transfer): void {
  const src = board[t.from] as WorkPlate;
  const dst = board[t.to] as WorkPlate;
  let removed = 0;
  src.slices = src.slices.filter((s) => {
    if (s === t.flavor && removed < t.count) {
      removed++;
      return false;
    }
    return true;
  });
  for (let i = 0; i < t.count; i++) dst.slices.push(t.flavor);
  dst.slices.sort((x, y) => x - y);
}

function freeze(p: WorkPlate): Plate {
  return { id: p.id, slices: p.slices };
}

function updateOrder(
  spec: OrderSpec,
  prev: OrderProgress,
  completedCakes: readonly number[],
  chainDepth: number,
  maxChainSoFar: number,
): OrderProgress {
  let value: number;
  switch (spec.kind) {
    case 'complete-flavor':
      value = completedCakes[spec.flavor] ?? 0;
      break;
    case 'complete-any':
      value = completedCakes.reduce((a, b) => a + b, 0);
      break;
    case 'complete-distinct':
      value = completedCakes.filter((n) => n > 0).length;
      break;
    case 'chain':
      value = Math.max(maxChainSoFar, chainDepth);
      break;
  }
  const target = prev.target;
  return { value: Math.min(value, target), target, complete: value >= target };
}

/**
 * Pure rules engine: immutable state + command in, new state + events + analysis out.
 * Rendering never influences this function. Throws IllegalMoveError for illegal commands.
 */
export function applyCommand(state: GameState, cmd: PlacePlateCommand): EngineResult {
  if (!isLegal(state, cmd)) throw new IllegalMoveError(`Illegal move: ${JSON.stringify(cmd)}`);

  const events: GameEvent[] = [];
  const placedCell = cellIndex(state, cmd.row, cmd.column);
  const trayPlate = state.tray[cmd.slot] as Plate;

  const board: (WorkPlate | null)[] = state.board.map((p) =>
    p ? { id: p.id, slices: p.slices.slice() } : null,
  );
  board[placedCell] = { id: trayPlate.id, slices: trayPlate.slices.slice() };
  events.push({ type: 'placed', plateId: trayPlate.id, cell: placedCell, slot: cmd.slot });

  // Tray update does not depend on resolution.
  const tray: (Plate | null)[] = state.tray.slice();
  let queueIndex = state.queueIndex;
  if (state.ruleset.trayMode === 'slot') {
    const next = state.queue[queueIndex] ?? null;
    tray[cmd.slot] = next;
    if (next) {
      queueIndex++;
      events.push({ type: 'tray-refill', slots: [cmd.slot] });
    }
  } else {
    tray[cmd.slot] = null;
    if (!tray.some((p) => p !== null) && queueIndex < state.queue.length) {
      const slots: number[] = [];
      for (let s = 0; s < tray.length && queueIndex < state.queue.length; s++) {
        tray[s] = state.queue[queueIndex++] as Plate;
        slots.push(s);
      }
      events.push({ type: 'tray-refill', slots });
    }
  }

  return settle(state, board, tray, queueIndex, placedCell, events, 1);
}

/**
 * Resolves a changed board: rounds of transfers and completions, orders, energy and status.
 * `activeStart` is the cell of the plate that triggered resolution; `moveCost` is how much the
 * move counter advances (tools that act on the board cost one, others none).
 */
export function settle(
  state: GameState,
  board: (WorkPlate | null)[],
  tray: (Plate | null)[],
  queueIndex: number,
  activeStart: number,
  events: GameEvent[],
  moveCost: number,
): EngineResult {
  // Resolution rounds. Round 1 examines the active plate; each later round examines only plates
  // that changed in the previous round. A round with completions counts toward chain depth.
  const completedCakes = state.completedCakes.slice();
  const interacting = new Set<number>();
  let activeCell = activeStart;
  let hot = new Set<number>([activeStart]);
  let round = 0;
  let chainDepth = 0;
  let cakes = 0;
  let transfers = 0;
  let cleared = 0;
  for (;;) {
    round++;
    const changed = new Set<number>();
    for (;;) {
      const t = findTransfer(state, board, activeCell, hot);
      if (!t) break;
      const from = board[t.from] as WorkPlate;
      const to = board[t.to] as WorkPlate;
      applyTransfer(board, t);
      transfers++;
      interacting.add(t.from);
      interacting.add(t.to);
      changed.add(t.from);
      changed.add(t.to);
      events.push({
        type: 'transfer',
        wave: round,
        flavor: t.flavor,
        count: t.count,
        fromPlateId: from.id,
        toPlateId: to.id,
        fromCell: t.from,
        toCell: t.to,
      });
      if (from.slices.length === 0) {
        board[t.from] = null;
        changed.delete(t.from);
        cleared++;
        events.push({ type: 'plate-cleared', wave: round, plateId: from.id, cell: t.from });
        if (t.from === activeCell) activeCell = -1;
      }
    }
    const done: number[] = [];
    for (let i = 0; i < board.length; i++) {
      const p = board[i];
      if (!p || p.slices.length !== state.ruleset.cakeSize) continue;
      if (p.slices[0] === p.slices[p.slices.length - 1]) done.push(i);
    }
    if (done.length > 0) chainDepth++;
    for (const i of done) {
      const p = board[i] as WorkPlate;
      const flavor = p.slices[0] as number;
      completedCakes[flavor] = (completedCakes[flavor] ?? 0) + 1;
      cakes++;
      interacting.add(i);
      events.push({
        type: 'cake-complete',
        wave: round,
        depth: chainDepth,
        plateId: p.id,
        flavor,
        cell: i,
      });
    }
    for (const i of done) {
      board[i] = null;
      changed.delete(i);
    }
    cleared += done.length;
    activeCell = -1;
    if (changed.size === 0) break;
    hot = changed;
  }
  if (chainDepth > 0) events.push({ type: 'chain', depth: chainDepth });

  // Orders.
  const prevMaxChain = state.orders.reduce((m, spec, i) => {
    if (spec.kind !== 'chain') return m;
    return Math.max(m, (state.orderProgress[i] as OrderProgress).value);
  }, 0);
  let ordersCompleted = 0;
  const orderProgress = state.orders.map((spec, i) => {
    const prev = state.orderProgress[i] as OrderProgress;
    const next = updateOrder(spec, prev, completedCakes, chainDepth, prevMaxChain);
    if (next.complete && !prev.complete) ordersCompleted++;
    if (next.value !== prev.value || next.complete !== prev.complete) {
      events.push({ type: 'order-progress', index: i, progress: next });
    }
    return next;
  });

  // Status.
  const boardOut: (Plate | null)[] = board.map((p) => (p ? freeze(p) : null));
  let empty = 0;
  for (let i = 0; i < boardOut.length; i++) if (state.playable[i] && boardOut[i] === null) empty++;
  let status: GameStatus = 'playing';
  if (orderProgress.every((o) => o.complete)) status = 'won';
  else if (empty === 0) status = 'lost';
  else if (!tray.some((p) => p !== null)) status = 'lost';
  if (status !== 'playing') events.push({ type: 'status', status });

  let scoreGain = 0;
  // Each cake scores 100 times its chain depth.
  for (const e of events) if (e.type === 'cake-complete') scoreGain += 100 * e.depth;

  // Sugar energy: only on levels that allow tools.
  let energy = state.energy;
  let grants = state.grants;
  if (state.allowedTools.length > 0) {
    energy += cakes + (chainDepth >= 2 ? 1 : 0) + 2 * ordersCompleted;
    grants += Math.floor(energy / ENERGY_PER_TOOL);
    energy %= ENERGY_PER_TOOL;
  }

  const nextState: GameState = {
    ...state,
    energy,
    grants,
    board: boardOut,
    tray,
    queueIndex,
    orderProgress,
    completedCakes,
    score: state.score + scoreGain,
    moveNumber: state.moveNumber + moveCost,
    status,
  };

  const analysis: MoveAnalysis = {
    cakesCompleted: cakes,
    chainDepth,
    transfers,
    spacesFreed: cleared,
    emptyCellsAfter: empty,
    interactingCells: [...interacting].sort((a, b) => a - b),
    ordersCompleted,
  };
  return { previousState: state, nextState, events, analysis };
}

/** Preview uses the real engine on the immutable state; nothing is mutated. */
export function previewMove(state: GameState, cmd: PlacePlateCommand): EngineResult | null {
  return isLegal(state, cmd) ? applyCommand(state, cmd) : null;
}

/** Canonical string for duplicate detection (ignores plate ids). */
export function stateKey(state: GameState): string {
  const plateKey = (p: Plate | null): string => (p ? p.slices.join('') : '-');
  return [
    state.board.map(plateKey).join('|'),
    state.tray.map(plateKey).join('|'),
    state.queueIndex,
    state.orderProgress.map((o) => o.value).join(','),
    state.completedCakes.join(','),
  ].join('/');
}

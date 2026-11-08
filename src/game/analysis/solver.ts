import { applyCommand, legalMoves, stateKey } from '../rules/engine';
import type { GameState, PlacePlateCommand } from '../model/types';

export interface SolveResult {
  solved: boolean;
  /** True when the whole space was searched (so `solved: false` means proven unsolvable). */
  complete: boolean;
  moves: PlacePlateCommand[];
  nodes: number;
}

interface Child {
  cmd: PlacePlateCommand;
  state: GameState;
  score: number;
  key: string;
}

/** Distinct children (by canonical state) ordered best-first by a simple heuristic. */
function children(state: GameState): Child[] {
  const seen = new Set<string>();
  const out: Child[] = [];
  for (const cmd of legalMoves(state)) {
    const r = applyCommand(state, cmd);
    const key = stateKey(r.nextState);
    if (seen.has(key)) continue;
    seen.add(key);
    const progress = r.nextState.orderProgress.reduce(
      (s, o) => s + (o.complete ? 2 : o.value / o.target),
      0,
    );
    const score =
      (r.nextState.status === 'won' ? 1000 : 0) +
      r.analysis.cakesCompleted * 10 +
      r.analysis.emptyCellsAfter * 2 +
      progress * 5;
    out.push({ cmd, state: r.nextState, score, key });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

/** Depth-first search with a failed-state set. Finds a winning line or proves none exists. */
export function findSolution(state: GameState, nodeBudget = 200_000): SolveResult {
  const failed = new Set<string>();
  let nodes = 0;
  let budgetHit = false;
  const path: PlacePlateCommand[] = [];

  const dfs = (s: GameState): boolean => {
    if (s.status === 'won') return true;
    if (s.status === 'lost') return false;
    if (nodes++ >= nodeBudget) {
      budgetHit = true;
      return false;
    }
    for (const c of children(s)) {
      if (failed.has(c.key)) continue;
      path.push(c.cmd);
      if (dfs(c.state)) return true;
      path.pop();
      if (budgetHit) return false;
      failed.add(c.key);
    }
    return false;
  };

  const solved = dfs(state);
  return { solved, complete: !budgetHit, moves: solved ? path.slice() : [], nodes };
}

export interface Analysis {
  complete: boolean;
  solvable: boolean;
  /** Shortest winning line length in moves, or null if none found. */
  shortest: number | null;
  /** Number of distinct winning move sequences (exact when complete). */
  routes: number;
  nodes: number;
}

interface Info {
  win: boolean;
  min: number;
  routes: number;
}

class BudgetExceeded extends Error {}

/** Exhaustive memoised analysis from a state: solvability, shortest line, route count. */
export function analyze(state: GameState, nodeBudget = 300_000): Analysis {
  const memo = new Map<string, Info>();
  let nodes = 0;
  const visit = (s: GameState, key: string): Info => {
    const hit = memo.get(key);
    if (hit) return hit;
    if (s.status === 'won') {
      const info = { win: true, min: 0, routes: 1 };
      memo.set(key, info);
      return info;
    }
    if (s.status === 'lost') {
      const info = { win: false, min: Infinity, routes: 0 };
      memo.set(key, info);
      return info;
    }
    if (nodes++ >= nodeBudget) throw new BudgetExceeded();
    let min = Infinity;
    let routes = 0;
    // Routes count distinct commands, so identical-result moves each count.
    for (const cmd of legalMoves(s)) {
      const next = applyCommand(s, cmd).nextState;
      const child = visit(next, stateKey(next));
      if (child.win) {
        min = Math.min(min, child.min + 1);
        routes += child.routes;
      }
    }
    const info = { win: routes > 0, min, routes };
    memo.set(key, info);
    return info;
  };
  try {
    const root = visit(state, stateKey(state));
    return {
      complete: true,
      solvable: root.win,
      shortest: root.win ? root.min : null,
      routes: root.routes,
      nodes,
    };
  } catch (e) {
    if (!(e instanceof BudgetExceeded)) throw e;
    return { complete: false, solvable: false, shortest: null, routes: 0, nodes };
  }
}

export interface VerificationReceipt {
  levelId: string;
  trayMode: string;
  solvable: boolean;
  solution: PlacePlateCommand[];
  firstMoves: number;
  viableFirstMoves: number;
  /** True when the exhaustive analysis finished, so route counts and shortest line are exact. */
  exact: boolean;
  routes: number | null;
  shortest: number | null;
  nodes: number;
}

/** Fair Bake receipt for one state. */
export function verify(
  state: GameState,
  budgets = { find: 300_000, analyze: 150_000, perFirst: 30_000 },
): VerificationReceipt {
  const found = findSolution(state, budgets.find);
  const full = analyze(state, budgets.analyze);
  const firsts = children(state);
  let viable = 0;
  for (const c of firsts) {
    if (c.state.status === 'won') {
      viable++;
      continue;
    }
    if (findSolution(c.state, budgets.perFirst).solved) viable++;
  }
  return {
    levelId: state.levelId,
    trayMode: state.ruleset.trayMode,
    solvable: found.solved,
    solution: found.moves,
    firstMoves: firsts.length,
    viableFirstMoves: viable,
    exact: full.complete,
    routes: full.complete ? full.routes : null,
    shortest: full.complete ? full.shortest : found.solved ? found.moves.length : null,
    nodes: found.nodes + full.nodes,
  };
}

export interface ShortestResult {
  /** Length of the shortest winning line found, or null. */
  length: number | null;
  moves: PlacePlateCommand[];
  /** True when every shorter depth was exhausted, so `length` is the true minimum. */
  proven: boolean;
  nodes: number;
}

/**
 * Iterative-deepening search for the shortest winning line. A transposition table
 * remembers the largest remaining depth already proven insufficient for a state,
 * so each deepening pass reuses earlier work.
 */
export function shortestLine(
  state: GameState,
  maxDepth = 24,
  nodeBudget = 150_000,
): ShortestResult {
  let nodes = 0;
  const failedAt = new Map<string, number>();
  let budgetHit = false;
  const path: PlacePlateCommand[] = [];

  const dfs = (s: GameState, key: string, left: number): boolean => {
    if (s.status === 'won') return true;
    if (s.status === 'lost' || left === 0) return false;
    if ((failedAt.get(key) ?? -1) >= left) return false;
    if (nodes++ >= nodeBudget) {
      budgetHit = true;
      return false;
    }
    for (const c of children(s)) {
      path.push(c.cmd);
      if (dfs(c.state, c.key, left - 1)) return true;
      path.pop();
      if (budgetHit) return false;
    }
    failedAt.set(key, left);
    return false;
  };

  const rootKey = stateKey(state);
  for (let depth = 0; depth <= maxDepth; depth++) {
    path.length = 0;
    if (dfs(state, rootKey, depth))
      return { length: path.length, moves: path.slice(), proven: true, nodes };
    if (budgetHit) return { length: null, moves: [], proven: false, nodes };
  }
  return { length: null, moves: [], proven: false, nodes };
}

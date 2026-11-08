import { stateKey } from '../rules/engine';
import { applyAny, isToolCommand } from '../rules/apply';
import { applyCommand } from '../rules/engine';
import type { Command, GameState } from '../model/types';
import { boardMetrics } from './metrics';
import { evaluateMoves, type MoveEval } from './hints';
import { findSolution } from './solver';

export interface FailureReport {
  /** False when solver budget prevented proving where the route closed; values are then best-known. */
  conclusive: boolean;
  /** Index (moves played) of the last position with a solver-confirmed winning route; null if none. */
  lastWinningIndex: number | null;
  /** The move played from that position, the first after which no confirmed route remained. */
  criticalMove: Command | null;
  criticalPlate: readonly number[] | null;
  /** Moves played after the critical move before the deadlock. */
  movesAfterCritical: number;
  /** Most fragmented flavour at the last winning position, with the plates it was spread over. */
  fragmented: { flavor: number; plates: number } | null;
  /** A move at that position that completes a cake where the played move did not, and still wins. */
  missedCompletion: MoveEval | null;
  /** The best verified winning alternative to the critical move. */
  alternative: MoveEval | null;
}

const EMPTY: FailureReport = {
  conclusive: false,
  lastWinningIndex: null,
  criticalMove: null,
  criticalPlate: null,
  movesAfterCritical: 0,
  fragmented: null,
  missedCompletion: null,
  alternative: null,
};

/**
 * Finds where the winning route closed along a lost line. A position with a route can only be
 * followed by positions with or without one, and once a route is gone it never returns, so a
 * binary search over the line locates the boundary with few solver runs.
 *
 * Tools are never required, so "winning route" means a route that uses no tools. A tool move can
 * restore such a route, so with tools in the line the boundary found is a boundary, not the only one.
 *
 * `states[i]` is the position after i moves and `moves[i]` the move played from it.
 */
export function analyzeFailure(
  states: readonly GameState[],
  moves: readonly Command[],
  budget = 300_000,
): FailureReport {
  const n = moves.length;
  if (n === 0 || states.length !== n + 1) return EMPTY;
  const start = findSolution(states[0] as GameState, budget);
  if (!start.solved) return { ...EMPTY, conclusive: start.complete };

  let lo = 0; // known winnable
  let hi = n; // the lost position
  let conclusive = true;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const r = findSolution(states[mid] as GameState, budget);
    if (r.solved) lo = mid;
    else if (r.complete) hi = mid;
    else {
      conclusive = false;
      break;
    }
  }
  // When the search is inconclusive, the move after `lo` is only a candidate.
  const atLo = states[lo] as GameState;
  const played = moves[lo] as Command;
  const playedKey = stateKey(applyAny(atLo, played).nextState);
  const evals = evaluateMoves(atLo, { childBudget: 60_000 });
  const playedEval =
    evals.find((e) => stateKey(applyCommand(atLo, e.cmd).nextState) === playedKey) ?? null;
  const alternative =
    evals.find(
      (e) => e.verdict === 'win' && stateKey(applyCommand(atLo, e.cmd).nextState) !== playedKey,
    ) ?? null;
  const missedCompletion =
    evals.find((e) => e.verdict === 'win' && e.cakes > 0 && (playedEval?.cakes ?? 0) === 0) ?? null;
  const m = boardMetrics(atLo);
  const fragmented =
    m.mostFragmentedFlavor === null
      ? null
      : {
          flavor: m.mostFragmentedFlavor,
          plates: m.platesPerFlavor[m.mostFragmentedFlavor] ?? 0,
        };
  return {
    conclusive,
    lastWinningIndex: lo,
    criticalMove: played,
    criticalPlate: isToolCommand(played) ? null : (atLo.tray[played.slot]?.slices ?? null),
    movesAfterCritical: n - (lo + 1),
    fragmented,
    missedCompletion,
    alternative,
  };
}

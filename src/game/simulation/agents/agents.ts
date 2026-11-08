import { applyCommand, legalMoves } from '../../rules/engine';
import type { Rng } from '../../rules/rng';
import { findSolution } from '../../analysis/solver';
import { boardMetrics } from '../../analysis/metrics';
import type { GameState, PlacePlateCommand } from '../../model/types';

export interface AgentContext {
  rng: Rng;
  /** Moves played so far in this game. */
  turn: number;
}

export interface GameAgent {
  id: string;
  chooseMove(state: GameState, context: AgentContext): PlacePlateCommand;
}

/** Sum of squared group sizes per plate: higher means flavours are gathered on fewer plates. */
export function concentration(state: GameState): number {
  let total = 0;
  for (const p of state.board) {
    if (!p) continue;
    let run = 0;
    for (let i = 0; i < p.slices.length; i++) {
      run++;
      if (i === p.slices.length - 1 || p.slices[i + 1] !== p.slices[i]) {
        total += run * run;
        run = 0;
      }
    }
  }
  return total;
}

/** The shared heuristic used by the strong agents: cakes, order progress, space and gathering. */
export function stateEval(state: GameState): number {
  if (state.status === 'won') return 100_000;
  if (state.status === 'lost') return -100_000;
  const m = boardMetrics(state);
  const cakes = state.completedCakes.reduce((a, b) => a + b, 0);
  return cakes * 100 + m.orderProgress * 40 + m.emptyCells * 8 + concentration(state);
}

export interface Candidate {
  cmd: PlacePlateCommand;
  next: GameState;
  cakes: number;
  chain: number;
  empty: number;
  fragmentation: number;
  orderProgress: number;
  score: number;
}

export function candidates(state: GameState): Candidate[] {
  return legalMoves(state).map((cmd) => {
    const r = applyCommand(state, cmd);
    const m = boardMetrics(r.nextState);
    return {
      cmd,
      next: r.nextState,
      cakes: r.analysis.cakesCompleted,
      chain: r.analysis.chainDepth,
      empty: r.analysis.emptyCellsAfter,
      fragmentation: m.fragmentation,
      orderProgress: m.orderProgress,
      score: stateEval(r.nextState),
    };
  });
}

/** Picks uniformly among the candidates with the highest key; ties are broken by the seeded rng. */
function pickBest(
  state: GameState,
  ctx: AgentContext,
  key: (c: Candidate) => number[],
): PlacePlateCommand {
  const all = ctx.rng.shuffle(candidates(state));
  let best = all[0] as Candidate;
  let bestKey = key(best);
  for (const c of all) {
    const k = key(c);
    for (let i = 0; i < k.length; i++) {
      const a = k[i] as number;
      const b = bestKey[i] as number;
      if (a > b) {
        best = c;
        bestKey = k;
        break;
      }
      if (a < b) break;
    }
  }
  return best.cmd;
}

const terminal = (c: Candidate): number =>
  c.next.status === 'won' ? 1 : c.next.status === 'lost' ? -1 : 0;

export const RandomAgent: GameAgent = {
  id: 'random',
  chooseMove(state, { rng }) {
    const moves = legalMoves(state);
    return moves[rng.int(0, moves.length - 1)] as PlacePlateCommand;
  },
};

/** Takes the move that completes the most cakes, then the most space. */
export const CompletionAgent: GameAgent = {
  id: 'completion',
  chooseMove: (s, ctx) => pickBest(s, ctx, (c) => [terminal(c), c.cakes, c.empty]),
};

/** Keeps the most empty cells. */
export const SpaceAgent: GameAgent = {
  id: 'space',
  chooseMove: (s, ctx) => pickBest(s, ctx, (c) => [terminal(c), c.empty, c.cakes]),
};

/** Gathers flavours: maximises concentration, then cakes. */
export const GreedyMergeAgent: GameAgent = {
  id: 'greedy-merge',
  chooseMove: (s, ctx) =>
    pickBest(s, ctx, (c) => [terminal(c), concentration(c.next), c.cakes, c.empty]),
};

/** Chases order progress. */
export const OrderAgent: GameAgent = {
  id: 'order',
  chooseMove: (s, ctx) =>
    pickBest(s, ctx, (c) => [terminal(c), Math.round(c.orderProgress * 1000), c.cakes, c.empty]),
};

/** Looks for chain reactions. */
export const ComboAgent: GameAgent = {
  id: 'combo',
  chooseMove: (s, ctx) => pickBest(s, ctx, (c) => [terminal(c), c.chain, c.cakes, c.empty]),
};

/** Avoids a crowded board: space first, then low fragmentation. */
export const SafetyAgent: GameAgent = {
  id: 'safety',
  chooseMove: (s, ctx) =>
    pickBest(s, ctx, (c) => [terminal(c), c.empty, -c.fragmentation, c.cakes]),
};

/** Wants one cake of every flavour before repeating any. */
export const CollectorAgent: GameAgent = {
  id: 'collector',
  chooseMove(state, ctx) {
    const distinct = (s: GameState): number => s.completedCakes.filter((n) => n > 0).length;
    return pickBest(state, ctx, (c) => [terminal(c), distinct(c.next), c.cakes, c.empty]);
  },
};

/** Takes any completion on offer, otherwise plays at random. */
export const ImpatientAgent: GameAgent = {
  id: 'impatient',
  chooseMove(state, ctx) {
    const done = candidates(state).filter((c) => c.cakes > 0);
    if (done.length > 0) return (done[ctx.rng.int(0, done.length - 1)] as Candidate).cmd;
    return RandomAgent.chooseMove(state, ctx);
  },
};

/** Strong but human: usually the best-rated move, sometimes the second or third. */
export const HumanErrorAgent: GameAgent = {
  id: 'human-error',
  chooseMove(state, ctx) {
    const ranked = ctx.rng.shuffle(candidates(state)).sort((a, b) => b.score - a.score);
    const roll = ctx.rng.next();
    const idx = roll < 0.85 ? 0 : roll < 0.95 ? 1 : 2;
    return (ranked[Math.min(idx, ranked.length - 1)] as Candidate).cmd;
  },
};

/** Searches `depth` turns ahead with a beam, using the shared heuristic at the leaves. */
export function makeLookaheadAgent(depth = 3, beam = 5): GameAgent {
  const value = (s: GameState, d: number): number => {
    if (s.status !== 'playing' || d === 0) return stateEval(s) + (s.status === 'won' ? d : 0);
    const kids = candidates(s)
      .sort((a, b) => b.score - a.score)
      .slice(0, beam);
    let best = -Infinity;
    for (const k of kids) best = Math.max(best, value(k.next, d - 1));
    return best;
  };
  return {
    id: `lookahead${depth}`,
    chooseMove(state, ctx) {
      let best: Candidate | null = null;
      let bestValue = -Infinity;
      for (const c of ctx.rng.shuffle(candidates(state))) {
        const v = value(c.next, depth - 1);
        if (v > bestValue) {
          bestValue = v;
          best = c;
        }
      }
      return (best as Candidate).cmd;
    },
  };
}
export const LookaheadAgent = makeLookaheadAgent(3, 5);

const lines = new Map<string, PlacePlateCommand[]>();

/** Follows a solver-found winning line; the line is cached per starting position. */
export const SolverAgent: GameAgent = {
  id: 'solver',
  chooseMove(state, ctx) {
    const key = `${state.levelId}/${state.ruleset.trayMode}/${state.moveNumber}`;
    if (ctx.turn === 0) {
      const found = findSolution(state, 400_000);
      lines.set(key, found.moves);
    }
    // Re-solve whenever the cached line is missing (for example after a deviation).
    const line = lines.get(`${state.levelId}/${state.ruleset.trayMode}/0`);
    const cmd = line?.[state.moveNumber];
    if (cmd) return cmd;
    const again = findSolution(state, 400_000);
    return (again.moves[0] ?? RandomAgent.chooseMove(state, ctx)) as PlacePlateCommand;
  },
};

export const AGENTS: Record<string, GameAgent> = Object.fromEntries(
  [
    RandomAgent,
    CompletionAgent,
    SpaceAgent,
    GreedyMergeAgent,
    OrderAgent,
    ComboAgent,
    SafetyAgent,
    CollectorAgent,
    ImpatientAgent,
    HumanErrorAgent,
    LookaheadAgent,
    SolverAgent,
  ].map((a) => [a.id, a]),
);

/** Deterministic agents need only one run per level. */
export const DETERMINISTIC_AGENTS = new Set(['solver']);

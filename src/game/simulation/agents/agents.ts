import { applyCommand, legalMoves } from '../../rules/engine';
import { createRng } from '../../rules/rng';
import type { GameState, PlacePlateCommand } from '../../model/types';

export interface GameAgent {
  id: string;
  chooseMove(state: GameState, rngSeed: string): PlacePlateCommand;
}

export const RandomAgent: GameAgent = {
  id: 'random',
  chooseMove(state, rngSeed) {
    const moves = legalMoves(state);
    const rng = createRng(rngSeed);
    return moves[rng.int(0, moves.length - 1)] as PlacePlateCommand;
  },
};

/**
 * Merge-aware greedy agent: rewards completed cakes and win, concentration of flavours on few
 * plates (sum of squared group sizes) and empty space.
 */
export const GreedyAgent: GameAgent = {
  id: 'greedy',
  chooseMove(state) {
    let best: PlacePlateCommand | null = null;
    let bestScore = -Infinity;
    for (const m of legalMoves(state)) {
      const r = applyCommand(state, m);
      let concentration = 0;
      for (const p of r.nextState.board) {
        if (!p) continue;
        const counts = new Map<number, number>();
        for (const f of p.slices) counts.set(f, (counts.get(f) ?? 0) + 1);
        for (const c of counts.values()) concentration += c * c;
      }
      const score =
        (r.nextState.status === 'won' ? 10000 : 0) +
        (r.nextState.status === 'lost' ? -10000 : 0) +
        r.analysis.cakesCompleted * 100 +
        r.analysis.emptyCellsAfter * 8 +
        concentration;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best as PlacePlateCommand;
  },
};

export const AGENTS: Record<string, GameAgent> = {
  random: RandomAgent,
  greedy: GreedyAgent,
};

import type { GameState } from '../model/types';

export interface BoardMetrics {
  /** Share of playable cells holding a plate, 0 to 1. */
  occupancy: number;
  emptyCells: number;
  /** Plates holding each flavour. */
  platesPerFlavor: number[];
  /** Extra plates beyond the minimum needed to hold each flavour, summed. */
  fragmentation: number;
  mostFragmentedFlavor: number | null;
  /** Sum of order progress fractions, higher is closer to winning. */
  orderProgress: number;
}

export function boardMetrics(state: GameState): BoardMetrics {
  const platesPerFlavor = Array.from({ length: state.flavorCount }, () => 0);
  const slicesPerFlavor = Array.from({ length: state.flavorCount }, () => 0);
  let plates = 0;
  let playable = 0;
  for (let i = 0; i < state.board.length; i++) {
    if (state.playable[i]) playable++;
    const p = state.board[i];
    if (!p) continue;
    plates++;
    const seen = new Set<number>();
    for (const f of p.slices) {
      slicesPerFlavor[f] = (slicesPerFlavor[f] ?? 0) + 1;
      seen.add(f);
    }
    for (const f of seen) platesPerFlavor[f] = (platesPerFlavor[f] ?? 0) + 1;
  }
  let fragmentation = 0;
  let worst: number | null = null;
  let worstExcess = 0;
  for (let f = 0; f < state.flavorCount; f++) {
    const count = slicesPerFlavor[f] ?? 0;
    if (count === 0) continue;
    const minimum = Math.ceil(count / state.ruleset.cakeSize);
    const excess = (platesPerFlavor[f] ?? 0) - minimum;
    fragmentation += excess;
    if (excess > worstExcess) {
      worstExcess = excess;
      worst = f;
    }
  }
  const orderProgress = state.orderProgress.reduce(
    (s, o) => s + (o.target === 0 ? 1 : o.value / o.target),
    0,
  );
  return {
    occupancy: playable === 0 ? 0 : plates / playable,
    emptyCells: playable - plates,
    platesPerFlavor,
    fragmentation,
    mostFragmentedFlavor: worst,
    orderProgress,
  };
}

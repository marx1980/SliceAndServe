import { createInitialState } from '../generation/expand';
import { hashSeed } from '../rules/rng';
import type { LevelDefinition, PlacePlateCommand, TrayMode } from '../model/types';
import { verify, shortestLine } from './solver';

/** Fair Bake verification record for one level in one tray mode. */
export interface Receipt {
  levelId: string;
  trayMode: TrayMode;
  /** Hash of the level definition; a mismatch means the receipt is outdated. */
  levelHash: number;
  seed: string;
  solvable: boolean;
  /** A complete winning line, replayable with the real engine. */
  solution: PlacePlateCommand[];
  firstMoves: number;
  viableFirstMoves: number;
  /** True when the exhaustive search finished, so routes and shortest are exact. */
  exact: boolean;
  /** Exact route count when `exact`, otherwise a lower bound (at least one route per viable first move). */
  routes: number;
  shortest: number | null;
  /** True when `shortest` is the proven minimum (iterative deepening finished). */
  shortestProven: boolean;
  /** A shortest line, replayable with the real engine. */
  shortestLine: PlacePlateCommand[];
}

export function levelHash(level: LevelDefinition): number {
  // Presentation-only fields do not affect solvability, so they stay out of the hash.
  const rules: { -readonly [K in keyof LevelDefinition]?: LevelDefinition[K] } = { ...level };
  delete rules.moveTarget;
  delete rules.title;
  return hashSeed(JSON.stringify(rules));
}

export function makeReceipt(level: LevelDefinition, trayMode: TrayMode): Receipt {
  const initial = createInitialState(level, { trayMode });
  const r = verify(initial);
  const sh = shortestLine(initial);
  return {
    levelId: level.id,
    trayMode,
    levelHash: levelHash(level),
    seed: level.generation.seed,
    solvable: r.solvable,
    solution: r.solution,
    firstMoves: r.firstMoves,
    viableFirstMoves: r.viableFirstMoves,
    exact: r.exact,
    routes: r.exact && r.routes !== null ? r.routes : r.viableFirstMoves,
    shortest: sh.length ?? r.shortest,
    shortestProven: sh.proven,
    shortestLine: sh.length === null ? r.solution : sh.moves,
  };
}

export type ReceiptStatus = 'verified' | 'outdated' | 'missing';

export function receiptStatus(level: LevelDefinition, receipt: Receipt | undefined): ReceiptStatus {
  if (!receipt) return 'missing';
  return receipt.levelHash === levelHash(level) && receipt.solvable ? 'verified' : 'outdated';
}

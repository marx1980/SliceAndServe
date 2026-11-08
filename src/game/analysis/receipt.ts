import { createInitialState } from '../generation/expand';
import { hashSeed } from '../rules/rng';
import type { LevelDefinition, PlacePlateCommand, TrayMode } from '../model/types';
import { verify } from './solver';

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
}

export function levelHash(level: LevelDefinition): number {
  return hashSeed(JSON.stringify(level));
}

export function makeReceipt(level: LevelDefinition, trayMode: TrayMode): Receipt {
  const r = verify(createInitialState(level, { trayMode }));
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
    shortest: r.shortest,
  };
}

export type ReceiptStatus = 'verified' | 'outdated' | 'missing';

export function receiptStatus(level: LevelDefinition, receipt: Receipt | undefined): ReceiptStatus {
  if (!receipt) return 'missing';
  return receipt.levelHash === levelHash(level) && receipt.solvable ? 'verified' : 'outdated';
}

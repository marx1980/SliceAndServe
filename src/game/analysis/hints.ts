import { applyCommand, legalMoves, stateKey } from '../rules/engine';
import type { GameState, PlacePlateCommand } from '../model/types';
import { boardMetrics } from './metrics';
import { findSolution } from './solver';

export type Verdict = 'win' | 'no-win' | 'unknown';

export interface MoveEval {
  cmd: PlacePlateCommand;
  /** Slices of the plate being placed. */
  plate: readonly number[];
  /** Solver result for the position after this move. */
  verdict: Verdict;
  /** Moves to win from the solver's line, this move included; null unless verdict is win. */
  lineLength: number | null;
  cakes: number;
  chainDepth: number;
  transfers: number;
  spacesFreed: number;
  emptyAfter: number;
  fragmentationAfter: number;
  orderProgressAfter: number;
}

const RANK: Record<Verdict, number> = { win: 0, unknown: 1, 'no-win': 2 };

export interface EvalOptions {
  /** Solver node budget per candidate move. */
  childBudget?: number;
}

/** Evaluate every distinct legal move with the real engine and solver, best first. */
export function evaluateMoves(state: GameState, opts: EvalOptions = {}): MoveEval[] {
  const budget = opts.childBudget ?? 20_000;
  const seen = new Set<string>();
  const out: MoveEval[] = [];
  for (const cmd of legalMoves(state)) {
    const r = applyCommand(state, cmd);
    const key = stateKey(r.nextState);
    if (seen.has(key)) continue;
    seen.add(key);
    let verdict: Verdict;
    let lineLength: number | null = null;
    if (r.nextState.status === 'won') {
      verdict = 'win';
      lineLength = 1;
    } else if (r.nextState.status === 'lost') {
      verdict = 'no-win';
    } else {
      const s = findSolution(r.nextState, budget);
      verdict = s.solved ? 'win' : s.complete ? 'no-win' : 'unknown';
      if (s.solved) lineLength = s.moves.length + 1;
    }
    const m = boardMetrics(r.nextState);
    out.push({
      cmd,
      plate: state.tray[cmd.slot]?.slices ?? [],
      verdict,
      lineLength,
      cakes: r.analysis.cakesCompleted,
      chainDepth: r.analysis.chainDepth,
      transfers: r.analysis.transfers,
      spacesFreed: r.analysis.spacesFreed,
      emptyAfter: r.analysis.emptyCellsAfter,
      fragmentationAfter: m.fragmentation,
      orderProgressAfter: m.orderProgress,
    });
  }
  return out.sort(
    (a, b) =>
      RANK[a.verdict] - RANK[b.verdict] ||
      (a.lineLength ?? 99) - (b.lineLength ?? 99) ||
      b.cakes - a.cakes ||
      b.emptyAfter - a.emptyAfter ||
      a.fragmentationAfter - b.fragmentationAfter,
  );
}

export interface HintData {
  /** 'confirmed' when the best move has a solver-confirmed winning route; 'dead' when none exists. */
  certainty: 'confirmed' | 'heuristic' | 'dead';
  evals: MoveEval[];
  /** Up to three distinct promising cells (rung 1), best first. */
  cells: number[];
  best: MoveEval | null;
  /** Best move followed by the solver's line, as commands (rung 5 and 6). */
  line: PlacePlateCommand[];
  /** Winning alternatives to the best move, counted by distinct results. */
  winningMoves: number;
  totalMoves: number;
}

/** Everything the six-rung hint ladder needs, computed once per position. */
export function computeHints(state: GameState, opts: EvalOptions = {}): HintData {
  const evals = evaluateMoves(state, opts);
  const best = evals[0] ?? null;
  const certainty: HintData['certainty'] = !best
    ? 'dead'
    : best.verdict === 'win'
      ? 'confirmed'
      : evals.every((e) => e.verdict === 'no-win')
        ? 'dead'
        : 'heuristic';
  const cells: number[] = [];
  for (const e of evals) {
    if (certainty === 'dead') break;
    const cell = e.cmd.row * state.columns + e.cmd.column;
    if (!cells.includes(cell)) cells.push(cell);
    if (cells.length === 3) break;
  }
  let line: PlacePlateCommand[] = [];
  if (best && certainty !== 'dead') {
    line = [best.cmd];
    const next = applyCommand(state, best.cmd).nextState;
    if (next.status === 'playing') {
      const s = findSolution(next, 300_000);
      if (s.solved) line = line.concat(s.moves);
    }
  }
  return {
    certainty,
    evals,
    cells,
    best,
    line,
    winningMoves: evals.filter((e) => e.verdict === 'win').length,
    totalMoves: evals.length,
  };
}

export interface ExplainRow {
  /** String-table key for the label. */
  key: string;
  value: string;
}

/** Label/value rows generated from real simulation data about a move. */
export function explainMove(state: GameState, move: MoveEval, hints: HintData): ExplainRow[] {
  const before = boardMetrics(state);
  const rows: ExplainRow[] = [];
  rows.push({ key: 'cakes', value: String(move.cakes) });
  if (move.chainDepth > 1) rows.push({ key: 'chain', value: String(move.chainDepth) });
  rows.push({ key: 'emptyCells', value: `${before.emptyCells} → ${move.emptyAfter}` });
  rows.push({
    key: 'fragmentation',
    value: `${before.fragmentation} → ${move.fragmentationAfter}`,
  });
  const gain = move.orderProgressAfter - before.orderProgress;
  rows.push({ key: 'orderProgress', value: `+${gain.toFixed(2)}` });
  if (move.lineLength !== null) rows.push({ key: 'route', value: String(move.lineLength) });
  rows.push({ key: 'winningMoves', value: `${hints.winningMoves}/${hints.totalMoves}` });
  return rows;
}

export interface TeachComparison {
  /** Same distinct result as the recommendation. */
  matchesBest: boolean;
  chosen: MoveEval | null;
  best: MoveEval | null;
  /** Label/value rows: key, chosen value, recommended value. */
  rows: Array<{ key: string; chosen: string; best: string }>;
}

/** Compare a played move against the recommendation using the same evaluations. */
export function compareMoves(
  state: GameState,
  played: PlacePlateCommand,
  evals: MoveEval[],
): TeachComparison {
  const playedKey = stateKey(applyCommand(state, played).nextState);
  const chosen =
    evals.find((e) => stateKey(applyCommand(state, e.cmd).nextState) === playedKey) ?? null;
  const best = evals[0] ?? null;
  const matchesBest =
    !!chosen &&
    !!best &&
    (chosen === best ||
      (chosen.verdict === 'win' &&
        best.verdict === 'win' &&
        chosen.lineLength === best.lineLength));
  const f = (n: number | null | undefined): string =>
    n === null || n === undefined ? '—' : String(n);
  const verdict = (e: MoveEval | null): string => (e ? e.verdict : '—');
  const rows = [
    { key: 'route', chosen: f(chosen?.lineLength), best: f(best?.lineLength) },
    { key: 'verdict', chosen: verdict(chosen), best: verdict(best) },
    { key: 'cakes', chosen: f(chosen?.cakes), best: f(best?.cakes) },
    { key: 'chain', chosen: f(chosen?.chainDepth), best: f(best?.chainDepth) },
    { key: 'emptyCells', chosen: f(chosen?.emptyAfter), best: f(best?.emptyAfter) },
    {
      key: 'fragmentation',
      chosen: f(chosen?.fragmentationAfter),
      best: f(best?.fragmentationAfter),
    },
    {
      key: 'orderProgress',
      chosen: chosen ? chosen.orderProgressAfter.toFixed(2) : '—',
      best: best ? best.orderProgressAfter.toFixed(2) : '—',
    },
  ];
  return { matchesBest, chosen, best, rows };
}

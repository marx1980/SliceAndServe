import { createInitialState } from '../generation/expand';
import { applyCommand } from '../rules/engine';
import { createRng } from '../rules/rng';
import { boardMetrics } from '../analysis/metrics';
import type { LevelDefinition, TrayMode } from '../model/types';
import { candidates, type GameAgent } from './agents/agents';

/** What happened in one simulated game. */
export interface GameRecord {
  seed: number;
  won: boolean;
  moves: number;
  /** Move number of the first cake, or null. */
  firstCompletion: number | null;
  /** Longest run of moves that neither merged slices nor completed a cake. */
  longestDry: number;
  peakOccupancy: number;
  occupancyByTurn: number[];
  /** Move number at which the game was lost, or null. */
  failureTurn: number | null;
  /** Per turn: distinct outcomes among legal moves (by cakes, space, fragmentation, order progress). */
  choiceCounts: number[];
  /** Turns where exactly one resulting position has the top heuristic score. */
  dominantTurns: number;
  fragmentationSum: number;
  maxChain: number;
  combos: number;
  resolveMs: number;
}

const MAX_TURNS = 300;

/** Plays one full game with a seeded agent; all randomness comes from the seed. */
export function playGame(
  level: LevelDefinition,
  agent: GameAgent,
  seed: number,
  trayMode: TrayMode,
): GameRecord {
  const rng = createRng(`${level.id}:${agent.id}:${trayMode}:${seed}`);
  let state = createInitialState(level, { trayMode });
  const playable = state.playable.filter(Boolean).length;
  const rec: GameRecord = {
    seed,
    won: false,
    moves: 0,
    firstCompletion: null,
    longestDry: 0,
    peakOccupancy: 0,
    occupancyByTurn: [],
    failureTurn: null,
    choiceCounts: [],
    dominantTurns: 0,
    fragmentationSum: 0,
    maxChain: 0,
    combos: 0,
    resolveMs: 0,
  };
  let dry = 0;
  let turn = 0;
  while (state.status === 'playing' && turn < MAX_TURNS) {
    // Choice statistics use the same candidate evaluation the strong agents use.
    const cands = candidates(state);
    const outcomes = new Set(
      cands.map((c) => `${c.cakes}|${c.empty}|${c.fragmentation}|${c.orderProgress.toFixed(3)}`),
    );
    rec.choiceCounts.push(outcomes.size);
    let top = -Infinity;
    let topCount = 0;
    const seen = new Set<string>();
    for (const c of cands) {
      const key = `${c.score}|${c.cakes}|${c.empty}|${c.fragmentation}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (c.score > top) {
        top = c.score;
        topCount = 1;
      } else if (c.score === top) topCount++;
    }
    if (topCount === 1) rec.dominantTurns++;

    const cmd = agent.chooseMove(state, { rng, turn });
    const t0 = performance.now();
    const r = applyCommand(state, cmd);
    rec.resolveMs += performance.now() - t0;
    state = r.nextState;
    turn++;
    const occupancy = 1 - r.analysis.emptyCellsAfter / playable;
    rec.occupancyByTurn.push(occupancy);
    rec.peakOccupancy = Math.max(rec.peakOccupancy, occupancy);
    rec.fragmentationSum += boardMetrics(state).fragmentation;
    if (r.analysis.cakesCompleted > 0 && rec.firstCompletion === null) rec.firstCompletion = turn;
    if (r.analysis.transfers === 0 && r.analysis.cakesCompleted === 0) {
      dry++;
      rec.longestDry = Math.max(rec.longestDry, dry);
    } else dry = 0;
    rec.maxChain = Math.max(rec.maxChain, r.analysis.chainDepth);
    if (r.analysis.chainDepth >= 2) rec.combos++;
  }
  rec.moves = turn;
  rec.won = state.status === 'won';
  if (state.status === 'lost') rec.failureTurn = turn;
  return rec;
}

export interface Summary {
  level: string;
  agent: string;
  trayMode: TrayMode;
  runs: number;
  winRate: number;
  /** 95% Wilson interval for the win rate. */
  winRateLow: number;
  winRateHigh: number;
  avgMoves: number;
  medianMoves: number;
  stdMoves: number;
  avgFirstCompletion: number | null;
  avgLongestDry: number;
  maxLongestDry: number;
  /** Share of games whose longest dry spell exceeded four moves. */
  dryOverFourRate: number;
  avgPeakOccupancy: number;
  occupancyByTurn: number[];
  avgFailureTurn: number | null;
  avgMeaningfulChoices: number;
  /** Share of turns offering at least two meaningfully different outcomes. */
  twoChoiceTurnRate: number;
  dominantMoveRate: number;
  avgFragmentation: number;
  /** Share of games containing at least one chain of depth 2 or more. */
  comboRate: number;
  /** Share of won games that contained a chain of depth 2 or more. */
  winsWithChainRate: number;
  maxChain: number;
  /** Win rate among games that reached 80% occupancy, and how many did. */
  comebackRate: number | null;
  comebackGames: number;
  avgResolveMs: number;
  totalMs: number;
}

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
const round = (n: number, d = 4): number => Number(n.toFixed(d));

function wilson(wins: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

export function summarize(
  level: string,
  agent: string,
  trayMode: TrayMode,
  records: GameRecord[],
  totalMs: number,
): Summary {
  const n = records.length;
  const wins = records.filter((r) => r.won).length;
  const [lo, hi] = wilson(wins, n);
  const moves = records.map((r) => r.moves).sort((a, b) => a - b);
  const avgMoves = mean(moves);
  const std = Math.sqrt(mean(moves.map((m) => (m - avgMoves) ** 2)));
  const firsts = records.map((r) => r.firstCompletion).filter((x): x is number => x !== null);
  const fails = records.map((r) => r.failureTurn).filter((x): x is number => x !== null);
  const choices = records.flatMap((r) => r.choiceCounts);
  const turns = records.reduce((s, r) => s + r.moves, 0);
  const crowded = records.filter((r) => r.peakOccupancy >= 0.8);
  const longest = Math.max(0, ...records.map((r) => r.occupancyByTurn.length));
  const occ: number[] = [];
  for (let t = 0; t < longest; t++) {
    const at = records
      .filter((r) => r.occupancyByTurn.length > t)
      .map((r) => r.occupancyByTurn[t] as number);
    occ.push(round(mean(at), 3));
  }
  const wonRecords = records.filter((r) => r.won);
  return {
    level,
    agent,
    trayMode,
    runs: n,
    winRate: round(wins / Math.max(1, n)),
    winRateLow: round(lo),
    winRateHigh: round(hi),
    avgMoves: round(avgMoves, 2),
    medianMoves: moves[Math.floor(n / 2)] ?? 0,
    stdMoves: round(std, 2),
    avgFirstCompletion: firsts.length ? round(mean(firsts), 2) : null,
    avgLongestDry: round(mean(records.map((r) => r.longestDry)), 2),
    maxLongestDry: Math.max(0, ...records.map((r) => r.longestDry)),
    dryOverFourRate: round(records.filter((r) => r.longestDry > 4).length / Math.max(1, n)),
    avgPeakOccupancy: round(mean(records.map((r) => r.peakOccupancy)), 3),
    occupancyByTurn: occ,
    avgFailureTurn: fails.length ? round(mean(fails), 2) : null,
    avgMeaningfulChoices: round(mean(choices), 2),
    twoChoiceTurnRate: round(choices.filter((c) => c >= 2).length / Math.max(1, choices.length)),
    dominantMoveRate: round(records.reduce((s, r) => s + r.dominantTurns, 0) / Math.max(1, turns)),
    avgFragmentation: round(
      records.reduce((s, r) => s + r.fragmentationSum, 0) / Math.max(1, turns),
      3,
    ),
    comboRate: round(records.filter((r) => r.combos > 0).length / Math.max(1, n)),
    winsWithChainRate: round(
      wonRecords.filter((r) => r.maxChain >= 2).length / Math.max(1, wonRecords.length),
    ),
    maxChain: Math.max(0, ...records.map((r) => r.maxChain)),
    comebackRate: crowded.length
      ? round(crowded.filter((r) => r.won).length / crowded.length)
      : null,
    comebackGames: crowded.length,
    avgResolveMs: round(records.reduce((s, r) => s + r.resolveMs, 0) / Math.max(1, turns), 4),
    totalMs,
  };
}

/** Runs a batch of seeded games and summarises them. Pure; used by the CLI and its workers. */
export function runBatch(
  level: LevelDefinition,
  agent: GameAgent,
  trayMode: TrayMode,
  seedFrom: number,
  seedCount: number,
): GameRecord[] {
  const out: GameRecord[] = [];
  for (let i = 0; i < seedCount; i++) out.push(playGame(level, agent, seedFrom + i, trayMode));
  return out;
}

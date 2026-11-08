import { createInitialState } from '../generation/expand';
import { applyAny, isToolCommand } from '../rules/apply';
import type { Command, LevelDefinition, MasteryGoal, TrayMode } from '../model/types';

export interface MasteryOutcome {
  won: boolean;
  maxChain: number;
  score: number;
  minEmpty: number;
  toolsUsed: number;
}

/** Replays a command list with the real engine and collects what mastery goals look at. */
export function playOutcome(
  level: LevelDefinition,
  trayMode: TrayMode,
  commands: readonly Command[],
): MasteryOutcome {
  let state = createInitialState(level, { trayMode });
  let maxChain = 0;
  let toolsUsed = 0;
  let minEmpty = state.playable.filter(Boolean).length;
  for (const cmd of commands) {
    const r = applyAny(state, cmd);
    state = r.nextState;
    maxChain = Math.max(maxChain, r.analysis.chainDepth);
    if (isToolCommand(cmd) && cmd.tool !== 'grant') toolsUsed++;
    if (!(isToolCommand(cmd) && (cmd.tool === 'grant' || cmd.tool === 'spoon'))) {
      minEmpty = Math.min(minEmpty, r.analysis.emptyCellsAfter);
    }
  }
  return { won: state.status === 'won', maxChain, score: state.score, minEmpty, toolsUsed };
}

export function goalMet(goal: MasteryGoal, o: MasteryOutcome): boolean {
  if (!o.won) return false;
  switch (goal.kind) {
    case 'chain':
      return o.maxChain >= goal.depth;
    case 'score':
      return o.score >= goal.points;
    case 'tidy':
      return o.minEmpty >= goal.minEmpty;
    case 'no-tools':
      return o.toolsUsed === 0;
  }
}

/** True when the commands win the level and satisfy its mastery goal. */
export function masteryMet(
  level: LevelDefinition,
  trayMode: TrayMode,
  commands: readonly Command[],
): boolean {
  if (!level.mastery) return false;
  return goalMet(level.mastery, playOutcome(level, trayMode, commands));
}

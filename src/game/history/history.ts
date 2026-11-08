import { applyCommand } from '../rules/engine';
import type { EngineResult, GameState, PlacePlateCommand } from '../model/types';

/**
 * Linear timeline of stable states. Undo and scrubbing restore exact states.
 * Branching is added in Phase 3 on top of this structure.
 */
export class History {
  private readonly states: GameState[];
  private readonly commands: PlacePlateCommand[] = [];

  constructor(initial: GameState) {
    this.states = [initial];
  }

  get current(): GameState {
    return this.states[this.states.length - 1] as GameState;
  }

  get initial(): GameState {
    return this.states[0] as GameState;
  }

  get length(): number {
    return this.states.length;
  }

  get moves(): readonly PlacePlateCommand[] {
    return this.commands;
  }

  play(cmd: PlacePlateCommand): EngineResult {
    const result = applyCommand(this.current, cmd);
    this.states.push(result.nextState);
    this.commands.push(cmd);
    return result;
  }

  canUndo(): boolean {
    return this.states.length > 1;
  }

  undo(): GameState {
    if (this.canUndo()) {
      this.states.pop();
      this.commands.pop();
    }
    return this.current;
  }

  /** Restore the stable state after `index` moves (0 is the start). */
  rewindTo(index: number): GameState {
    const target = Math.max(0, Math.min(index, this.states.length - 1));
    this.states.length = target + 1;
    this.commands.length = target;
    return this.current;
  }

  restart(): GameState {
    return this.rewindTo(0);
  }
}

/** Replays commands from an initial state; used by tests and saves. */
export function replay(initial: GameState, commands: readonly PlacePlateCommand[]): GameState {
  let state = initial;
  for (const cmd of commands) state = applyCommand(state, cmd).nextState;
  return state;
}

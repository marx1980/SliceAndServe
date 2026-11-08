import type {
  Command,
  EngineResult,
  GameState,
  PlacePlateCommand,
  ToolCommand,
} from '../model/types';
import { applyCommand } from './engine';
import { applyTool } from './tools';

export const isToolCommand = (c: Command): c is ToolCommand => 'tool' in c;

/** Applies any recorded player action. Placement stays in `applyCommand`; tools in `applyTool`. */
export function applyAny(state: GameState, cmd: Command): EngineResult {
  return isToolCommand(cmd) ? applyTool(state, cmd) : applyCommand(state, cmd as PlacePlateCommand);
}

export function sameCommand(a: Command, b: Command): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

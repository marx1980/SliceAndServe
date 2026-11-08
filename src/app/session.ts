import type {
  LevelDefinition,
  EngineResult,
  GameState,
  PlacePlateCommand,
} from '../game/model/types';
import { createInitialState } from '../game/generation/expand';
import { History } from '../game/history/history';
import { LEVELS } from '../content/levels';
import {
  loadProgress,
  loadSettings,
  recordWin,
  saveProgress,
  saveSettings,
  type Progress,
  type Settings,
} from '../save/storage';

export interface SessionEvent {
  kind: 'level' | 'move' | 'undo' | 'seek' | 'restart' | 'settings';
  result?: EngineResult;
}

type Listener = (e: SessionEvent) => void;

/** Glue between the rules engine, history, settings and save data. No rendering here. */
export class GameSession {
  settings: Settings = loadSettings();
  progress: Progress = loadProgress();
  level: LevelDefinition = LEVELS[0] as LevelDefinition;
  history: History;
  private listeners: Listener[] = [];

  constructor() {
    this.history = new History(this.newState(this.level));
  }

  private newState(level: LevelDefinition): GameState {
    return createInitialState(level, { trayMode: this.settings.trayMode });
  }

  get state(): GameState {
    return this.history.current;
  }

  subscribe(fn: Listener): void {
    this.listeners.push(fn);
  }

  private emit(e: SessionEvent): void {
    for (const l of this.listeners) l(e);
  }

  startLevel(id: string): void {
    this.level = LEVELS.find((l) => l.id === id) ?? (LEVELS[0] as LevelDefinition);
    this.history = new History(this.newState(this.level));
    this.emit({ kind: 'level' });
  }

  nextLevelId(): string | null {
    const i = LEVELS.findIndex((l) => l.id === this.level.id);
    return LEVELS[i + 1]?.id ?? null;
  }

  place(cmd: PlacePlateCommand): EngineResult {
    const result = this.history.play(cmd);
    if (result.nextState.status === 'won') {
      const moves = result.nextState.moveNumber;
      this.progress = recordWin(this.progress, this.level.id, moves, this.hatsFor(moves));
      saveProgress(this.progress);
    }
    this.emit({ kind: 'move', result });
    return result;
  }

  hatsFor(moves: number): number {
    return 1 + (moves <= this.level.moveTarget ? 1 : 0);
  }

  undo(): void {
    if (!this.history.canUndo()) return;
    this.history.undo();
    this.emit({ kind: 'undo' });
  }

  redo(): void {
    if (!this.history.canRedo()) return;
    this.history.redo();
    this.emit({ kind: 'seek' });
  }

  /** Scrub to the state after `index` moves on the active branch. */
  seek(index: number): void {
    this.history.rewindTo(index);
    this.emit({ kind: 'seek' });
  }

  goToNode(id: number): void {
    this.history.goToNode(id);
    this.emit({ kind: 'seek' });
  }

  switchBranch(leafId: number): void {
    this.history.switchBranch(leafId);
    this.emit({ kind: 'seek' });
  }

  toggleBookmark(): void {
    this.history.toggleBookmark();
    this.emit({ kind: 'seek' });
  }

  /** Back to the start. The timeline is kept unless the tray model setting changed. */
  restart(): void {
    if (this.state.ruleset.trayMode === this.settings.trayMode) {
      this.history.restart();
    } else {
      this.history = new History(this.newState(this.level));
    }
    this.emit({ kind: 'restart' });
  }

  updateSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    this.emit({ kind: 'settings' });
  }
}

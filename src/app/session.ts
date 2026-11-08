import type {
  ModeId,
  Command,
  LevelDefinition,
  EngineResult,
  GameState,
  PlacePlateCommand,
  ToolCommand,
} from '../game/model/types';
import { masteryMet, playOutcome } from '../game/progression/mastery';
import { levelHash } from '../game/analysis/receipt';
import { dialogueFor, type DialogueLine } from '../content/dialogue';
import { isToolCommand } from '../game/rules/apply';
import { createInitialState } from '../game/generation/expand';
import { History } from '../game/history/history';
import { LEVELS } from '../content/levels';
import { endlessLevel } from '../game/modes/generate';
import {
  clearSuspended,
  loadProgress,
  loadSuspended,
  saveSuspended,
  loadSettings,
  recordWin,
  recordModeWin,
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
  /** Which mode the current puzzle belongs to. Only campaign puzzles touch hats and the bakery. */
  mode: ModeId = 'campaign';
  /** Running Endless Service session: seed, stage and score banked from cleared stages. */
  endless = { seed: '', stage: 0, banked: 0 };
  private listeners: Listener[] = [];

  constructor() {
    const last = LEVELS.find((l) => l.id === this.progress.lastLevel);
    if (last) this.level = last;
    this.history = this.restoreOrNew(this.level);
  }

  /** Resumes the saved timeline for a level when it still fits, otherwise starts fresh. */
  private restoreOrNew(level: LevelDefinition): History {
    const initial = this.newState(level);
    const saved = loadSuspended(level.id);
    if (
      saved &&
      saved.levelHash === levelHash(level) &&
      saved.trayMode === this.settings.trayMode
    ) {
      const restored = History.restore(initial, saved.history);
      if (restored && restored.current.status === 'playing') return restored;
    }
    clearSuspended(level.id);
    return new History(initial);
  }

  /** Autosave after every stable state change. A finished or untouched timeline is not stored. */
  private suspend(): void {
    const h = this.history;
    if (h.length <= 1 && h.cursorId === 0) {
      clearSuspended(this.level.id);
      return;
    }
    saveSuspended({
      schemaVersion: 1,
      levelId: this.level.id,
      levelHash: levelHash(this.level),
      trayMode: this.settings.trayMode,
      history: h.serialize(),
      savedAt: Date.now(),
    });
  }

  get hasSuspended(): boolean {
    return this.history.length > 1;
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
    this.mode = 'campaign';
    this.history = this.restoreOrNew(this.level);
    this.progress = { ...this.progress, lastLevel: this.level.id };
    saveProgress(this.progress);
    this.emit({ kind: 'level' });
  }

  /** Starts any non-campaign puzzle. Its timeline autosaves under the puzzle id like campaign levels. */
  startPuzzle(level: LevelDefinition, mode: ModeId): void {
    this.level = level;
    this.mode = mode;
    this.history = this.restoreOrNew(level);
    this.emit({ kind: 'level' });
  }

  startEndless(seed: string, stage = 1, banked = 0): void {
    this.endless = { seed, stage, banked };
    this.progress = {
      ...this.progress,
      modes: {
        ...this.progress.modes,
        endless: { ...this.progress.modes.endless, lastSeed: seed },
      },
    };
    saveProgress(this.progress);
    this.startPuzzle(endlessLevel(seed, stage), 'endless');
  }

  nextEndless(): void {
    this.startEndless(
      this.endless.seed,
      this.endless.stage + 1,
      this.endless.banked + this.state.score,
    );
  }

  nextLevelId(): string | null {
    if (this.mode !== 'campaign') return null;
    const i = LEVELS.findIndex((l) => l.id === this.level.id);
    return LEVELS[i + 1]?.id ?? null;
  }

  place(cmd: PlacePlateCommand): EngineResult {
    return this.act(cmd);
  }

  useTool(cmd: ToolCommand): EngineResult {
    return this.act(cmd);
  }

  private act(cmd: Command): EngineResult {
    const result = this.history.play(cmd);
    if (result.nextState.status === 'won') {
      this.recordWinFor(result.nextState);
      clearSuspended(this.level.id);
    } else {
      this.suspend();
    }
    this.emit({ kind: 'move', result });
    return result;
  }

  /** Whose turn it is in Pass-the-Cake (0 or 1). Derived from the active timeline, so undo hands the turn back. */
  passPlayer(): number {
    return this.history.moves.filter((m) => !isToolCommand(m)).length % 2;
  }

  /** Cakes and score credited to each player by the placements they made. */
  passStats(): Array<{ cakes: number; score: number }> {
    const out = [
      { cakes: 0, score: 0 },
      { cakes: 0, score: 0 },
    ];
    const states = this.history.statesToCursor();
    const moves = this.history.moves;
    let placements = 0;
    moves.forEach((m, i) => {
      const a = states[i] as GameState;
      const b = states[i + 1] as GameState;
      const who = placements % 2;
      if (!isToolCommand(m)) placements++;
      const mine = out[who] as { cakes: number; score: number };
      mine.cakes +=
        b.completedCakes.reduce((x, y) => x + y, 0) - a.completedCakes.reduce((x, y) => x + y, 0);
      mine.score += b.score - a.score;
    });
    return out;
  }

  /** What a winning timeline looked like, for mode scoring: moves, score, best chain, peak occupancy. */
  winStats(): { moves: number; score: number; chain: number; peak: number } {
    const o = playOutcome(this.level, this.state.ruleset.trayMode, this.history.moves);
    const cells = this.state.playable.filter(Boolean).length;
    return {
      moves: this.state.moveNumber,
      score: o.score,
      chain: o.maxChain,
      peak: cells - o.minEmpty,
    };
  }

  private recordWinFor(state: GameState): void {
    if (this.mode === 'campaign') {
      const hats = this.hatsFor(state);
      this.progress = recordWin(this.progress, this.level.id, state.moveNumber, hats);
    } else if (this.mode === 'endless') {
      const total = this.endless.banked + state.score;
      const e = this.progress.modes.endless;
      this.progress = {
        ...this.progress,
        modes: {
          ...this.progress.modes,
          endless: {
            ...e,
            bestStage: Math.max(e.bestStage, this.endless.stage),
            bestScore: Math.max(e.bestScore, total),
          },
        },
      };
    } else if (this.mode !== 'zen' && this.mode !== 'pass') {
      this.progress = recordModeWin(this.progress, this.level.id, this.winStats());
    }
    saveProgress(this.progress);
  }

  /** Hats earned by the winning timeline at the cursor. The first hat is the win itself. */
  hatsFor(state: GameState): { moves: boolean; mastery: boolean } {
    return {
      moves: state.moveNumber <= this.level.moveTarget,
      mastery: masteryMet(this.level, state.ruleset.trayMode, this.history.moves),
    };
  }

  /** Story lines not yet seen for this level, honouring the skip setting. */
  pendingDialogue(when: 'before' | 'after'): DialogueLine[] {
    if (this.settings.skipDialogue) return [];
    // End-to-end runs start without story unless the test asks for it.
    const q = typeof location === 'undefined' ? null : new URLSearchParams(location.search);
    if (q?.has('e2e') && !q.has('story')) return [];
    return dialogueFor(this.level.id, when).filter(
      (d) => !this.progress.seenDialogue.includes(d.id),
    );
  }

  markDialogueSeen(lines: readonly DialogueLine[]): void {
    this.progress = {
      ...this.progress,
      seenDialogue: [...this.progress.seenDialogue, ...lines.map((l) => l.id)],
    };
    saveProgress(this.progress);
  }

  /** Test hook: restart the current level with a patched initial state (end-to-end runs only). */
  debugStart(patch: Partial<GameState>): void {
    this.history = new History({ ...this.newState(this.level), ...patch });
    this.emit({ kind: 'restart' });
  }

  setBakeryStyle(areaId: string, style: 'a' | 'b'): void {
    this.progress = {
      ...this.progress,
      bakeryStyles: { ...this.progress.bakeryStyles, [areaId]: style },
    };
    saveProgress(this.progress);
  }

  markEndingSeen(): void {
    this.progress = { ...this.progress, endingSeen: true };
    saveProgress(this.progress);
  }

  undo(): void {
    if (!this.history.canUndo()) return;
    this.history.undo();
    this.suspend();
    this.emit({ kind: 'undo' });
  }

  redo(): void {
    if (!this.history.canRedo()) return;
    this.history.redo();
    this.suspend();
    this.emit({ kind: 'seek' });
  }

  /** Scrub to the state after `index` moves on the active branch. */
  seek(index: number): void {
    this.history.rewindTo(index);
    this.suspend();
    this.emit({ kind: 'seek' });
  }

  goToNode(id: number): void {
    this.history.goToNode(id);
    this.suspend();
    this.emit({ kind: 'seek' });
  }

  switchBranch(leafId: number): void {
    this.history.switchBranch(leafId);
    this.suspend();
    this.emit({ kind: 'seek' });
  }

  toggleBookmark(): void {
    this.history.toggleBookmark();
    this.suspend();
    this.emit({ kind: 'seek' });
  }

  /** Back to the start. The timeline is kept unless the tray model setting changed. */
  restart(): void {
    if (this.state.ruleset.trayMode === this.settings.trayMode) {
      this.history.restart();
    } else {
      this.history = new History(this.newState(this.level));
    }
    this.suspend();
    this.emit({ kind: 'restart' });
  }

  updateSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    this.emit({ kind: 'settings' });
  }
}

import type { SerializedHistory } from '../game/history/history';

export type Language = 'en' | 'hr';
export type AnimationSpeed = 'normal' | 'fast' | 'off';
export type TrayModeSetting = 'slot' | 'batch';

export type PlateTheme = 'classic' | 'pastel';
export type BakeryStyle = 'a' | 'b';

export interface Settings {
  schemaVersion: 2;
  trayMode: TrayModeSetting;
  animation: AnimationSpeed;
  /** When on, a tap first previews the placement and a second tap confirms. */
  confirmPlacement: boolean;
  soundVolume: number;
  language: Language;
  /** Compare each move with the solver's recommendation after it is played. */
  teachMe: boolean;
  /** Skip all story dialogue. */
  skipDialogue: boolean;
  plateTheme: PlateTheme;
}

export interface LevelProgress {
  completed: boolean;
  bestMoves: number;
  /** Second hat: finished within the suggested move count. */
  hatMoves: boolean;
  /** Third hat: the level's mastery goal. */
  hatMastery: boolean;
}

export interface Progress {
  schemaVersion: 2;
  levels: Record<string, LevelProgress>;
  /** Chosen visual style per restored bakery area. */
  bakeryStyles: Record<string, BakeryStyle>;
  seenDialogue: string[];
  lastLevel: string;
  endingSeen: boolean;
}

export const hatCount = (p: LevelProgress | undefined): number =>
  p ? (p.completed ? 1 : 0) + (p.hatMoves ? 1 : 0) + (p.hatMastery ? 1 : 0) : 0;

const SETTINGS_KEY = 'sliceandserve.settings';
const PROGRESS_KEY = 'sliceandserve.progress';
const SUSPENDED_KEY = 'sliceandserve.suspended';

export function defaultSettings(): Settings {
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    schemaVersion: 2,
    trayMode: 'slot',
    animation: reduced ? 'off' : 'normal',
    confirmPlacement: true,
    soundVolume: 0.6,
    language: 'en',
    teachMe: false,
    skipDialogue: false,
    plateTheme: 'classic',
  };
}

export function defaultProgress(): Progress {
  return {
    schemaVersion: 2,
    levels: {},
    bakeryStyles: {},
    seenDialogue: [],
    lastLevel: 'L01',
    endingSeen: false,
  };
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Migrate any older persisted settings to the current schema; returns null if unusable. */
export function migrateSettings(raw: unknown): Settings | null {
  if (!isObject(raw) || (raw.schemaVersion !== 1 && raw.schemaVersion !== 2)) return null;
  const d = defaultSettings();
  return {
    schemaVersion: 2,
    trayMode: raw.trayMode === 'batch' ? 'batch' : 'slot',
    animation:
      raw.animation === 'fast' || raw.animation === 'off' || raw.animation === 'normal'
        ? raw.animation
        : d.animation,
    confirmPlacement: typeof raw.confirmPlacement === 'boolean' ? raw.confirmPlacement : true,
    soundVolume:
      typeof raw.soundVolume === 'number'
        ? Math.max(0, Math.min(1, raw.soundVolume))
        : d.soundVolume,
    language: raw.language === 'hr' ? 'hr' : 'en',
    teachMe: raw.teachMe === true,
    skipDialogue: raw.skipDialogue === true,
    plateTheme: raw.plateTheme === 'pastel' ? 'pastel' : 'classic',
  };
}

/** Version 1 stored a single hat count; version 2 stores each hat. */
export function migrateProgress(raw: unknown): Progress | null {
  if (!isObject(raw) || (raw.schemaVersion !== 1 && raw.schemaVersion !== 2)) return null;
  if (!isObject(raw.levels)) return null;
  const levels: Record<string, LevelProgress> = {};
  for (const [id, v] of Object.entries(raw.levels)) {
    if (!isObject(v)) continue;
    const completed = v.completed === true;
    const oldHats = typeof v.hats === 'number' ? v.hats : 0;
    levels[id] = {
      completed,
      bestMoves: typeof v.bestMoves === 'number' ? v.bestMoves : 0,
      hatMoves: raw.schemaVersion === 1 ? completed && oldHats >= 2 : v.hatMoves === true,
      hatMastery: raw.schemaVersion === 1 ? false : v.hatMastery === true,
    };
  }
  const styles: Record<string, BakeryStyle> = {};
  if (isObject(raw.bakeryStyles)) {
    for (const [k, v] of Object.entries(raw.bakeryStyles))
      if (v === 'a' || v === 'b') styles[k] = v;
  }
  return {
    schemaVersion: 2,
    levels,
    bakeryStyles: styles,
    seenDialogue: Array.isArray(raw.seenDialogue)
      ? raw.seenDialogue.filter((x): x is string => typeof x === 'string')
      : [],
    lastLevel: typeof raw.lastLevel === 'string' ? raw.lastLevel : 'L01',
    endingSeen: raw.endingSeen === true,
  };
}

function load<T>(key: string, migrate: (raw: unknown) => T | null, fallback: () => T): T {
  const store = storage();
  if (!store) return fallback();
  const text = store.getItem(key);
  if (text === null) return fallback();
  try {
    const migrated = migrate(JSON.parse(text));
    if (migrated) return migrated;
  } catch {
    // fall through to corruption recovery
  }
  // Corruption recovery: keep the broken data aside, start fresh.
  try {
    store.setItem(`${key}.corrupt`, text);
  } catch {
    // ignore quota errors
  }
  return fallback();
}

function save(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable; play continues without persistence
  }
}

export const loadSettings = (): Settings => load(SETTINGS_KEY, migrateSettings, defaultSettings);
export const saveSettings = (s: Settings): void => save(SETTINGS_KEY, s);
export const loadProgress = (): Progress => load(PROGRESS_KEY, migrateProgress, defaultProgress);
export const saveProgress = (p: Progress): void => save(PROGRESS_KEY, p);

/** Record a win; progress only ever improves and failure never removes anything. */
export function recordWin(
  p: Progress,
  levelId: string,
  moves: number,
  hats: { moves: boolean; mastery: boolean },
): Progress {
  const prev = p.levels[levelId];
  return {
    ...p,
    levels: {
      ...p.levels,
      [levelId]: {
        completed: true,
        bestMoves: prev && prev.bestMoves > 0 ? Math.min(prev.bestMoves, moves) : moves,
        hatMoves: (prev?.hatMoves ?? false) || hats.moves,
        hatMastery: (prev?.hatMastery ?? false) || hats.mastery,
      },
    },
  };
}

export const completedCount = (p: Progress): number =>
  Object.values(p.levels).filter((l) => l.completed).length;

export const totalHats = (p: Progress): number =>
  Object.values(p.levels).reduce((n, l) => n + hatCount(l), 0);

// ---- suspended puzzles -----------------------------------------------------------------------

/** A suspended puzzle: the full timeline as commands plus what is needed to validate it on resume. */
export interface SuspendedGame {
  schemaVersion: 1;
  levelId: string;
  levelHash: number;
  trayMode: TrayModeSetting;
  history: SerializedHistory;
  savedAt: number;
}

type SuspendedStore = { schemaVersion: 1; games: Record<string, SuspendedGame> };

function readSuspended(): SuspendedStore {
  const store = storage();
  const empty: SuspendedStore = { schemaVersion: 1, games: {} };
  if (!store) return empty;
  const text = store.getItem(SUSPENDED_KEY);
  if (text === null) return empty;
  try {
    const raw = JSON.parse(text) as unknown;
    if (isObject(raw) && raw.schemaVersion === 1 && isObject(raw.games)) {
      return { schemaVersion: 1, games: raw.games as Record<string, SuspendedGame> };
    }
  } catch {
    // fall through
  }
  try {
    store.setItem(`${SUSPENDED_KEY}.corrupt`, text);
  } catch {
    // ignore quota errors
  }
  return empty;
}

export const loadSuspended = (levelId: string): SuspendedGame | undefined =>
  readSuspended().games[levelId];

export function saveSuspended(game: SuspendedGame): void {
  const s = readSuspended();
  s.games[game.levelId] = game;
  save(SUSPENDED_KEY, s);
}

export function clearSuspended(levelId: string): void {
  const s = readSuspended();
  if (!(levelId in s.games)) return;
  delete s.games[levelId];
  save(SUSPENDED_KEY, s);
}

/** Export every save record as one JSON text, and import it back. */
export function exportSaves(): string {
  return JSON.stringify({
    settings: loadSettings(),
    progress: loadProgress(),
    suspended: readSuspended(),
  });
}

export function importSaves(text: string): boolean {
  try {
    const raw = JSON.parse(text) as unknown;
    if (!isObject(raw)) return false;
    const settings = migrateSettings(raw.settings);
    const progress = migrateProgress(raw.progress);
    if (!settings || !progress) return false;
    saveSettings(settings);
    saveProgress(progress);
    if (isObject(raw.suspended) && raw.suspended.schemaVersion === 1)
      save(SUSPENDED_KEY, raw.suspended);
    return true;
  } catch {
    return false;
  }
}

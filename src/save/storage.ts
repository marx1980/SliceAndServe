export type Language = 'en' | 'hr';
export type AnimationSpeed = 'normal' | 'fast' | 'off';
export type TrayModeSetting = 'slot' | 'batch';

export interface Settings {
  schemaVersion: 1;
  trayMode: TrayModeSetting;
  animation: AnimationSpeed;
  /** When on, a tap first previews the placement and a second tap confirms. */
  confirmPlacement: boolean;
  soundVolume: number;
  language: Language;
}

export interface LevelProgress {
  completed: boolean;
  bestMoves: number;
  hats: number;
}

export interface Progress {
  schemaVersion: 1;
  levels: Record<string, LevelProgress>;
}

const SETTINGS_KEY = 'sliceandserve.settings';
const PROGRESS_KEY = 'sliceandserve.progress';

export function defaultSettings(): Settings {
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    schemaVersion: 1,
    trayMode: 'slot',
    animation: reduced ? 'off' : 'normal',
    confirmPlacement: true,
    soundVolume: 0.6,
    language: 'en',
  };
}

export function defaultProgress(): Progress {
  return { schemaVersion: 1, levels: {} };
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
  if (!isObject(raw) || raw.schemaVersion !== 1) return null;
  const d = defaultSettings();
  return {
    schemaVersion: 1,
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
  };
}

export function migrateProgress(raw: unknown): Progress | null {
  if (!isObject(raw) || raw.schemaVersion !== 1 || !isObject(raw.levels)) return null;
  const levels: Record<string, LevelProgress> = {};
  for (const [id, v] of Object.entries(raw.levels)) {
    if (!isObject(v)) continue;
    levels[id] = {
      completed: v.completed === true,
      bestMoves: typeof v.bestMoves === 'number' ? v.bestMoves : 0,
      hats: typeof v.hats === 'number' ? Math.max(0, Math.min(3, v.hats)) : 0,
    };
  }
  return { schemaVersion: 1, levels };
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
export function recordWin(p: Progress, levelId: string, moves: number, hats: number): Progress {
  const prev = p.levels[levelId];
  return {
    ...p,
    levels: {
      ...p.levels,
      [levelId]: {
        completed: true,
        bestMoves: prev && prev.bestMoves > 0 ? Math.min(prev.bestMoves, moves) : moves,
        hats: Math.max(prev?.hats ?? 0, hats),
      },
    },
  };
}

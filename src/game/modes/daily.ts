import { createRng } from '../rules/rng';
import type { LevelDefinition } from '../model/types';

/** Pre-verified daily puzzle as shipped in the manifest. */
export interface DailyEntry {
  tier: 1 | 2 | 3;
  level: LevelDefinition;
  /** Length of a known winning line per tray model; both are required to exist. */
  slotLine: number;
  batchLine: number;
}

export const DAILY_EPOCH_UTC = Date.UTC(2026, 0, 1);
/** Missed puzzles stay playable for this many days. */
export const DAILY_WINDOW = 7;
/** Weekday (0 = Sunday) to difficulty tier: gentle start of the week, hardest at the weekend. */
export const TIER_BY_WEEKDAY: readonly (1 | 2 | 3)[] = [3, 1, 1, 2, 2, 2, 3];

/** Weekdays (0 = Sunday) of each tier in week order, so every day of a week gets its own entry. */
const TIER_DAYS: readonly (readonly number[])[] = [
  [1, 2],
  [3, 4, 5],
  [0, 6],
];

export function dateKey(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseDateKey(key: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
    ? { y, m: mo, d }
    : null;
}

export function dayNumber(key: string): number {
  const p = parseDateKey(key);
  if (!p) throw new Error(`Bad date key ${key}`);
  return Math.round((Date.UTC(p.y, p.m - 1, p.d) - DAILY_EPOCH_UTC) / 86_400_000);
}

export function weekdayOf(key: string): number {
  const p = parseDateKey(key);
  if (!p) throw new Error(`Bad date key ${key}`);
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

/** The same date always selects the same puzzle, on every device, without a server. */
export function dailyFor(pool: readonly DailyEntry[], key: string): DailyEntry | null {
  const tier = TIER_BY_WEEKDAY[weekdayOf(key)] as 1 | 2 | 3;
  const entries = pool.filter((e) => e.tier === tier);
  if (entries.length === 0) return null;
  const order = createRng(`daily:${tier}`).shuffle(entries.map((_, i) => i));
  const wd = weekdayOf(key);
  const week = Math.floor((dayNumber(key) - wd) / 7);
  const days = TIER_DAYS[tier - 1] as readonly number[];
  const raw = week * days.length + days.indexOf(wd);
  const slot = ((raw % entries.length) + entries.length) % entries.length;
  return entries[order[slot] as number] ?? null;
}

export function dailyLevel(pool: readonly DailyEntry[], key: string): LevelDefinition | null {
  const e = dailyFor(pool, key);
  return e ? { ...e.level, id: `D-${key}`, title: key } : null;
}

/** Today first, then the previous days that can still be played. */
export function playableDays(today: string): string[] {
  const p = parseDateKey(today);
  if (!p) return [];
  const out: string[] = [];
  for (let i = 0; i < DAILY_WINDOW; i++) {
    const t = new Date(Date.UTC(p.y, p.m - 1, p.d - i));
    out.push(
      `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`,
    );
  }
  return out;
}

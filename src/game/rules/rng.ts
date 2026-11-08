/** Seeded random generator (mulberry32 over an FNV-1a string hash). The only randomness source in the project. */
export interface Rng {
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
  shuffle<T>(items: readonly T[]): T[];
}

export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(seed: string): Rng {
  let state = hashSeed(seed);
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  const shuffle = <T>(items: readonly T[]): T[] => {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = int(0, i);
      const tmp = a[i] as T;
      a[i] = a[j] as T;
      a[j] = tmp;
    }
    return a;
  };
  return { next, int, shuffle };
}

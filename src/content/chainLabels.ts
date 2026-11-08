/** Data-driven chain labels keyed on chain depth; the highest threshold not above the depth applies. */
export interface ChainLabel {
  depth: number;
  label: { en: string; hr: string };
}

export const CHAIN_LABELS: readonly ChainLabel[] = [
  { depth: 2, label: { en: 'Sweet Combo', hr: 'Slatki kombo' } },
  { depth: 3, label: { en: 'Delicious', hr: 'Fantastično' } },
  { depth: 4, label: { en: 'Master Baker', hr: 'Majstor slastičar' } },
  { depth: 5, label: { en: 'Bakery Rush', hr: 'Pekarska gužva' } },
];

export function chainLabel(depth: number, lang: 'en' | 'hr'): string | null {
  let found: ChainLabel | null = null;
  for (const c of CHAIN_LABELS) if (depth >= c.depth) found = c;
  return found ? found.label[lang] : null;
}

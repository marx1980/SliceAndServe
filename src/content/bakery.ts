import type { BakeryStyle } from '../save/storage';

export interface BakeryArea {
  id: string;
  name: { en: string; hr: string };
  /** Completed levels needed to restore the area. */
  restoredAt: number;
  styles: Record<BakeryStyle, { en: string; hr: string }>;
  glyph: string;
}

const STYLES = {
  a: { en: 'Cosy', hr: 'Ugodno' },
  b: { en: 'Modern', hr: 'Moderno' },
};

/** Seven persistent areas. Restoration is cosmetic: nothing gates play. */
export const BAKERY_AREAS: readonly BakeryArea[] = [
  {
    id: 'counter',
    name: { en: 'Front counter', hr: 'Pult' },
    restoredAt: 2,
    styles: STYLES,
    glyph: '🧁',
  },
  {
    id: 'kitchen',
    name: { en: 'Kitchen', hr: 'Kuhinja' },
    restoredAt: 6,
    styles: STYLES,
    glyph: '🍳',
  },
  {
    id: 'window',
    name: { en: 'Display window', hr: 'Izlog' },
    restoredAt: 10,
    styles: STYLES,
    glyph: '🪟',
  },
  {
    id: 'garden',
    name: { en: 'Tea garden', hr: 'Čajni vrt' },
    restoredAt: 15,
    styles: STYLES,
    glyph: '🍵',
  },
  {
    id: 'chocolate',
    name: { en: 'Chocolate room', hr: 'Čokoladna soba' },
    restoredAt: 20,
    styles: STYLES,
    glyph: '🍫',
  },
  {
    id: 'wedding',
    name: { en: 'Wedding-cake studio', hr: 'Atelijer svadbenih torti' },
    restoredAt: 25,
    styles: STYLES,
    glyph: '🎂',
  },
  {
    id: 'rooftop',
    name: { en: 'Rooftop cafe', hr: 'Krovni kafić' },
    restoredAt: 30,
    styles: STYLES,
    glyph: '🌇',
  },
];

export const isRestored = (area: BakeryArea, completed: number): boolean =>
  completed >= area.restoredAt;

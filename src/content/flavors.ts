import type { FlavorId } from '../game/model/types';

export type Glyph =
  'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'cross' | 'ring' | 'bar';

export interface FlavorDef {
  id: FlavorId;
  name: { en: string; hr: string };
  color: number;
  /** Secondary tone for the pattern. */
  accent: number;
  /** Distinct mark so flavours never rely on colour alone. */
  glyph: Glyph;
}

/** Eight flavours with placeholder colours and patterns; final food art comes later. */
export const FLAVORS: Record<FlavorId, FlavorDef> = {
  strawberry: {
    id: 'strawberry',
    name: { en: 'Strawberry', hr: 'Jagoda' },
    color: 0xe5484d,
    accent: 0xffc2c4,
    glyph: 'circle',
  },
  chocolate: {
    id: 'chocolate',
    name: { en: 'Chocolate', hr: 'Čokolada' },
    color: 0x7a4a2b,
    accent: 0xc9966b,
    glyph: 'square',
  },
  lemon: {
    id: 'lemon',
    name: { en: 'Lemon', hr: 'Limun' },
    color: 0xf2c94c,
    accent: 0xfff2b0,
    glyph: 'triangle',
  },
  pistachio: {
    id: 'pistachio',
    name: { en: 'Pistachio', hr: 'Pistacija' },
    color: 0x6fbf73,
    accent: 0xcdeccf,
    glyph: 'diamond',
  },
  blueberry: {
    id: 'blueberry',
    name: { en: 'Blueberry', hr: 'Borovnica' },
    color: 0x4a6fe3,
    accent: 0xc3d0fb,
    glyph: 'star',
  },
  caramel: {
    id: 'caramel',
    name: { en: 'Caramel', hr: 'Karamel' },
    color: 0xe08a2e,
    accent: 0xfad3a1,
    glyph: 'cross',
  },
  grape: {
    id: 'grape',
    name: { en: 'Grape', hr: 'Grožđe' },
    color: 0x9b59b6,
    accent: 0xe3c6ee,
    glyph: 'ring',
  },
  vanilla: {
    id: 'vanilla',
    name: { en: 'Vanilla', hr: 'Vanilija' },
    color: 0xf3e5c4,
    accent: 0xb59a5f,
    glyph: 'bar',
  },
};

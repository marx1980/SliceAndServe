import type Phaser from 'phaser';
import type { FlavorDef, Glyph } from '../../content/flavors';

const PLATE_FILL = 0xfffaf0;
const PLATE_EDGE = 0xcdbfa6;
const WEDGE_COUNT = 6;

function polygon(g: Phaser.GameObjects.Graphics, pts: Array<[number, number]>): void {
  g.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.closePath();
  g.fillPath();
}

/** Small mark drawn on every wedge so flavours never rely on colour alone. */
export function drawGlyph(
  g: Phaser.GameObjects.Graphics,
  glyph: Glyph,
  x: number,
  y: number,
  s: number,
  color: number,
): void {
  g.fillStyle(color, 1);
  g.lineStyle(Math.max(1.5, s * 0.28), color, 1);
  switch (glyph) {
    case 'circle':
      g.fillCircle(x, y, s * 0.8);
      break;
    case 'square':
      g.fillRect(x - s * 0.7, y - s * 0.7, s * 1.4, s * 1.4);
      break;
    case 'triangle':
      polygon(g, [
        [x, y - s],
        [x + s * 0.95, y + s * 0.75],
        [x - s * 0.95, y + s * 0.75],
      ]);
      break;
    case 'diamond':
      polygon(g, [
        [x, y - s],
        [x + s, y],
        [x, y + s],
        [x - s, y],
      ]);
      break;
    case 'star': {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? s : s * 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
      }
      polygon(g, pts);
      break;
    }
    case 'cross':
      g.lineBetween(x - s * 0.8, y - s * 0.8, x + s * 0.8, y + s * 0.8);
      g.lineBetween(x - s * 0.8, y + s * 0.8, x + s * 0.8, y - s * 0.8);
      break;
    case 'ring':
      g.strokeCircle(x, y, s * 0.7);
      break;
    case 'bar':
      g.fillRect(x - s * 0.95, y - s * 0.28, s * 1.9, s * 0.56);
      break;
  }
}

export interface PlateStyle {
  alpha?: number;
  outline?: number;
}

/** Draws a plate of up to six radial slices. `slices` hold flavour indices, sorted ascending. */
export function drawPlate(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  radius: number,
  slices: readonly number[],
  flavors: readonly FlavorDef[],
  style: PlateStyle = {},
): void {
  const alpha = style.alpha ?? 1;
  g.fillStyle(PLATE_FILL, alpha);
  g.fillCircle(cx, cy, radius);
  g.lineStyle(2, style.outline ?? PLATE_EDGE, alpha);
  g.strokeCircle(cx, cy, radius);
  const inner = radius * 0.86;
  for (let k = 0; k < WEDGE_COUNT; k++) {
    const a0 = -Math.PI / 2 + (k * 2 * Math.PI) / WEDGE_COUNT;
    const a1 = a0 + (2 * Math.PI) / WEDGE_COUNT;
    const flavorIdx = slices[k];
    const def = flavorIdx === undefined ? undefined : flavors[flavorIdx];
    if (!def) {
      g.lineStyle(1, PLATE_EDGE, 0.5 * alpha);
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, inner, a0, a1, false);
      g.closePath();
      g.strokePath();
      continue;
    }
    g.fillStyle(def.color, alpha);
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, inner, a0, a1, false);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.5, 0xffffff, alpha);
    g.strokePath();
    const mid = (a0 + a1) / 2;
    const gx = cx + Math.cos(mid) * inner * 0.62;
    const gy = cy + Math.sin(mid) * inner * 0.62;
    const accent = def.accent;
    drawGlyph(g, def.glyph, gx, gy, Math.max(3, radius * 0.13), accent);
  }
}

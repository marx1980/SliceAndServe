import Phaser from 'phaser';
import type { GameSession } from '../../app/session';
import { FLAVORS, type FlavorDef } from '../../content/flavors';
import { chainLabel } from '../../content/chainLabels';
import { t } from '../../ui/strings';
import { sfx } from '../../ui/sound';
import { drawPlate } from '../rendering/plateRenderer';
import { isLegal, previewMove } from '../rules/engine';
import type { EngineResult, GameState } from '../model/types';

export const LOGICAL_WIDTH = 360;
const PAD = 12;

export interface HintMarks {
  /** Cells to ring. */
  cells: number[];
  /** Tray slot to ring. */
  slot: number | null;
  /** Cell to mark as the recommended placement. */
  target: number | null;
  /** Numbered turn markers. */
  sequence: Array<{ cell: number; n: number }>;
}

export interface SceneHooks {
  /** Called whenever HUD-relevant scene state changes (selection, preview, level). */
  onChange(preview: EngineResult | null, selectedSlot: number | null): void;
  /** Called after a committed move with a short accessible description. */
  onMove(result: EngineResult): void;
}

interface Layout {
  cs: number;
  x0: number;
  y0: number;
  plateR: number;
  trayR: number;
  trayY: number;
  height: number;
}

export class BoardScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private layout!: Layout;
  private flavors: FlavorDef[] = [];
  private selectedSlot: number | null = null;
  private previewCell: number | null = null;
  private cursorCell = 0;
  private pending: { slot: number; x: number; y: number; wasSelected: boolean } | null = null;
  private drag: { slot: number; x: number; y: number } | null = null;
  private fx: Phaser.GameObjects.GameObject[] = [];
  private hint: HintMarks | null = null;
  private hintTexts: Phaser.GameObjects.Text[] = [];

  constructor(
    private readonly session: GameSession,
    private readonly hooks: SceneHooks,
  ) {
    super('board');
  }

  create(): void {
    this.gfx = this.add.graphics();
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.keyboard?.on('keydown', this.onKey, this);
    this.loadLevel();
  }

  /** Called by the app whenever a level starts or restarts. */
  loadLevel(): void {
    this.flavors = this.session.level.flavors.map(
      (id) => FLAVORS[id] ?? (FLAVORS['strawberry'] as FlavorDef),
    );
    this.selectedSlot = null;
    this.previewCell = null;
    this.drag = null;
    this.pending = null;
    this.cursorCell = this.firstPlayable();
    this.computeLayout();
    this.setHintMarks(null);
    this.clearFx();
    this.render();
    this.notify();
  }

  private firstPlayable(): number {
    const s = this.session.state;
    const i = s.playable.findIndex((p, idx) => p && s.board[idx] === null);
    return i < 0 ? 0 : i;
  }

  private computeLayout(): void {
    const s = this.session.state;
    const cs = Math.min(76, Math.floor((LOGICAL_WIDTH - 2 * PAD) / s.columns));
    const x0 = (LOGICAL_WIDTH - cs * s.columns) / 2;
    const y0 = PAD;
    const boardH = cs * s.rows;
    const trayR = Math.min(40, Math.floor(LOGICAL_WIDTH / 3 / 2) - 8);
    const trayY = y0 + boardH + 28 + trayR;
    const height = trayY + trayR + PAD + 6;
    this.layout = { cs, x0, y0, plateR: cs * 0.44, trayR, trayY, height };
    this.scale.setGameSize(LOGICAL_WIDTH, height);
  }

  private cellCenter(cell: number): { x: number; y: number } {
    const s = this.session.state;
    const { cs, x0, y0 } = this.layout;
    return {
      x: x0 + (cell % s.columns) * cs + cs / 2,
      y: y0 + Math.floor(cell / s.columns) * cs + cs / 2,
    };
  }

  private slotCenter(slot: number): { x: number; y: number } {
    return {
      x: (LOGICAL_WIDTH * (slot + 0.5)) / this.session.state.ruleset.traySize,
      y: this.layout.trayY,
    };
  }

  private cellAt(x: number, y: number): number {
    const s = this.session.state;
    const { cs, x0, y0 } = this.layout;
    const c = Math.floor((x - x0) / cs);
    const r = Math.floor((y - y0) / cs);
    if (c < 0 || r < 0 || c >= s.columns || r >= s.rows) return -1;
    const idx = r * s.columns + c;
    return s.playable[idx] ? idx : -1;
  }

  private slotAt(x: number, y: number): number {
    const s = this.session.state;
    for (let i = 0; i < s.tray.length; i++) {
      const c = this.slotCenter(i);
      if (s.tray[i] && Math.hypot(x - c.x, y - c.y) <= this.layout.trayR + 10) return i;
    }
    return -1;
  }

  private get lang() {
    return this.session.settings.language;
  }

  private speed(): number {
    const a = this.session.settings.animation;
    return a === 'off' ? 0 : a === 'fast' ? 0.5 : 1;
  }

  // ---- input -------------------------------------------------------------------------------

  private onDown(p: Phaser.Input.Pointer): void {
    sfx.unlock();
    if (this.session.state.status !== 'playing') return;
    const slot = this.slotAt(p.x, p.y);
    if (slot >= 0) {
      this.pending = { slot, x: p.x, y: p.y, wasSelected: this.selectedSlot === slot };
      this.selectedSlot = slot;
      this.previewCell = null;
      this.render();
      this.notify();
      return;
    }
    const cell = this.cellAt(p.x, p.y);
    if (cell < 0 || this.selectedSlot === null) {
      if (cell >= 0) this.cursorCell = cell;
      this.previewCell = null;
      this.render();
      this.notify();
      return;
    }
    this.cursorCell = cell;
    if (!this.isEmptyLegal(this.selectedSlot, cell)) {
      this.previewCell = null;
    } else if (!this.session.settings.confirmPlacement || this.previewCell === cell) {
      this.commit(this.selectedSlot, cell);
      return;
    } else {
      this.previewCell = cell;
    }
    this.render();
    this.notify();
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.pending && p.isDown) {
      if (!this.drag && Math.hypot(p.x - this.pending.x, p.y - this.pending.y) > 10) {
        this.drag = { slot: this.pending.slot, x: p.x, y: p.y };
      }
      if (this.drag) {
        this.drag.x = p.x;
        this.drag.y = p.y;
        const cell = this.cellAt(p.x, p.y);
        this.previewCell = cell >= 0 && this.isEmptyLegal(this.drag.slot, cell) ? cell : null;
        this.render();
        this.notify();
      }
    }
  }

  private onUp(): void {
    const pending = this.pending;
    const drag = this.drag;
    this.pending = null;
    this.drag = null;
    if (!pending) return;
    if (drag) {
      if (this.previewCell !== null) {
        this.commit(drag.slot, this.previewCell);
        return;
      }
      this.previewCell = null;
    } else if (pending.wasSelected) {
      // Tapping the selected plate again cancels the selection.
      this.selectedSlot = null;
      this.previewCell = null;
    }
    this.render();
    this.notify();
  }

  private onKey(ev: KeyboardEvent): void {
    const s = this.session.state;
    const key = ev.key;
    if (key === 'z' || key === 'Z' || key === 'Backspace') {
      this.session.undo();
      return;
    }
    if (s.status !== 'playing') return;
    const num = Number(key);
    if (num >= 1 && num <= s.tray.length && s.tray[num - 1]) {
      this.selectedSlot = this.selectedSlot === num - 1 ? null : num - 1;
      this.previewCell = null;
    } else if (key === 'Escape') {
      this.selectedSlot = null;
      this.previewCell = null;
    } else if (key.startsWith('Arrow')) {
      ev.preventDefault();
      this.moveCursor(key);
      if (this.selectedSlot !== null && this.isEmptyLegal(this.selectedSlot, this.cursorCell)) {
        this.previewCell = this.cursorCell;
      } else this.previewCell = null;
    } else if (key === 'Enter' || key === ' ') {
      ev.preventDefault();
      this.confirmPreview();
      return;
    }
    this.render();
    this.notify();
  }

  private moveCursor(key: string): void {
    const s = this.session.state;
    let r = Math.floor(this.cursorCell / s.columns);
    let c = this.cursorCell % s.columns;
    const dr = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
    const dc = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
    for (let step = 0; step < s.rows + s.columns; step++) {
      r = Math.max(0, Math.min(s.rows - 1, r + dr));
      c = Math.max(0, Math.min(s.columns - 1, c + dc));
      if (s.playable[r * s.columns + c]) break;
    }
    this.cursorCell = r * s.columns + c;
  }

  private isEmptyLegal(slot: number, cell: number): boolean {
    const s = this.session.state;
    return isLegal(s, { slot, row: Math.floor(cell / s.columns), column: cell % s.columns });
  }

  /** Place the selected plate at the previewed (or keyboard-cursor) cell. */
  confirmPreview(): void {
    if (this.selectedSlot === null) return;
    const cell = this.previewCell ?? this.cursorCell;
    if (this.isEmptyLegal(this.selectedSlot, cell)) this.commit(this.selectedSlot, cell);
  }

  cancelSelection(): void {
    this.selectedSlot = null;
    this.previewCell = null;
    this.render();
    this.notify();
  }

  /** Called after undo, scrubbing or restart so the scene drops stale selection. */
  refresh(result?: EngineResult): void {
    this.selectedSlot = null;
    this.previewCell = null;
    this.render();
    if (result) this.playEffects(result);
    this.notify();
  }

  /** Play a command as if the player made it (demonstrations and alternatives). */
  playCommand(cmd: { slot: number; row: number; column: number }): void {
    const s = this.session.state;
    this.commit(cmd.slot, cmd.row * s.columns + cmd.column);
  }

  setHintMarks(marks: HintMarks | null): void {
    for (const t of this.hintTexts) t.destroy();
    this.hintTexts = [];
    this.hint = marks;
    if (marks) {
      for (const m of marks.sequence) {
        const c = this.cellCenter(m.cell);
        const text = this.add
          .text(c.x, c.y, String(m.n), {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#ffffff',
          })
          .setOrigin(0.5)
          .setDepth(5);
        this.hintTexts.push(text);
      }
    }
    this.render();
  }

  private commit(slot: number, cell: number): void {
    const s = this.session.state;
    const result = this.session.place({
      slot,
      row: Math.floor(cell / s.columns),
      column: cell % s.columns,
    });
    this.selectedSlot = null;
    this.previewCell = null;
    this.cursorCell = cell;
    this.render();
    this.playEffects(result);
    this.hooks.onMove(result);
    this.notify();
  }

  private notify(): void {
    let preview: EngineResult | null = null;
    const s = this.session.state;
    if (this.selectedSlot !== null && this.previewCell !== null) {
      preview = previewMove(s, {
        slot: this.selectedSlot,
        row: Math.floor(this.previewCell / s.columns),
        column: this.previewCell % s.columns,
      });
    }
    this.hooks.onChange(preview, this.selectedSlot);
  }

  // ---- drawing -----------------------------------------------------------------------------

  private render(): void {
    const g = this.gfx;
    g.clear();
    const s = this.session.state;
    const { cs, x0, y0, plateR, trayR } = this.layout;

    for (let i = 0; i < s.board.length; i++) {
      if (!s.playable[i]) continue;
      const x = x0 + (i % s.columns) * cs;
      const y = y0 + Math.floor(i / s.columns) * cs;
      const empty = s.board[i] === null;
      const highlight = this.selectedSlot !== null && empty;
      g.fillStyle(highlight ? 0xfff0c2 : 0xefe3cc, 1);
      g.fillRoundedRect(x + 3, y + 3, cs - 6, cs - 6, 10);
      g.lineStyle(highlight ? 3 : 1.5, highlight ? 0xe0a030 : 0xd2c1a0, 1);
      g.strokeRoundedRect(x + 3, y + 3, cs - 6, cs - 6, 10);
    }

    // Keyboard cursor (visible focus).
    if (s.playable[this.cursorCell]) {
      const x = x0 + (this.cursorCell % s.columns) * cs;
      const y = y0 + Math.floor(this.cursorCell / s.columns) * cs;
      g.lineStyle(3, 0x2d6cdf, 1);
      g.strokeRoundedRect(x + 1, y + 1, cs - 2, cs - 2, 12);
    }

    for (let i = 0; i < s.board.length; i++) {
      const p = s.board[i];
      if (!p) continue;
      const c = this.cellCenter(i);
      drawPlate(g, c.x, c.y, plateR, p.slices, this.flavors);
    }

    // Tray.
    for (let i = 0; i < s.tray.length; i++) {
      const c = this.slotCenter(i);
      const p = s.tray[i];
      g.fillStyle(0x000000, 0.06);
      g.fillCircle(c.x, c.y + 3, trayR + 8);
      if (!p) continue;
      const selected = this.selectedSlot === i;
      const dragging = this.drag?.slot === i;
      if (dragging) {
        g.lineStyle(2, 0xcdbfa6, 0.4);
        g.strokeCircle(c.x, c.y, trayR);
        continue;
      }
      if (selected) {
        g.lineStyle(4, 0x2d6cdf, 1);
        g.strokeCircle(c.x, c.y, trayR + 6);
      }
      drawPlate(g, c.x, c.y, trayR, p.slices, this.flavors);
    }

    this.drawHint(g);
    this.drawPreview(g);

    if (this.drag) {
      const p = s.tray[this.drag.slot];
      if (p) drawPlate(g, this.drag.x, this.drag.y - 18, plateR + 6, p.slices, this.flavors);
    }
  }

  private drawHint(g: Phaser.GameObjects.Graphics): void {
    const h = this.hint;
    if (!h) return;
    const { plateR, trayR } = this.layout;
    for (const cell of h.cells) {
      const c = this.cellCenter(cell);
      g.lineStyle(4, 0x8e44ad, 1);
      g.strokeCircle(c.x, c.y, plateR + 7);
    }
    if (h.target !== null) {
      const c = this.cellCenter(h.target);
      g.fillStyle(0x8e44ad, 0.18);
      g.fillCircle(c.x, c.y, plateR + 7);
      g.lineStyle(4, 0x8e44ad, 1);
      g.strokeCircle(c.x, c.y, plateR + 7);
    }
    if (h.slot !== null) {
      const c = this.slotCenter(h.slot);
      g.lineStyle(4, 0x8e44ad, 1);
      g.strokeCircle(c.x, c.y, trayR + 10);
    }
    for (const m of h.sequence) {
      const c = this.cellCenter(m.cell);
      g.fillStyle(0x8e44ad, 0.9);
      g.fillCircle(c.x, c.y, 15);
    }
  }

  private drawPreview(g: Phaser.GameObjects.Graphics): void {
    const s = this.session.state;
    if (this.selectedSlot === null || this.previewCell === null) return;
    const result = previewMove(s, {
      slot: this.selectedSlot,
      row: Math.floor(this.previewCell / s.columns),
      column: this.previewCell % s.columns,
    });
    if (!result) return;
    const { plateR } = this.layout;
    const plate = s.tray[this.selectedSlot];
    const pc = this.cellCenter(this.previewCell);
    if (plate) drawPlate(g, pc.x, pc.y, plateR, plate.slices, this.flavors, { alpha: 0.6 });
    for (const cell of result.analysis.interactingCells) {
      const c = this.cellCenter(cell);
      g.lineStyle(3, 0x2d9d5a, 0.9);
      g.strokeCircle(c.x, c.y, plateR + 4);
    }
    for (const e of result.events) {
      if (e.type === 'transfer') {
        const a = this.cellCenter(e.fromCell);
        const b = this.cellCenter(e.toCell);
        this.arrow(g, a.x, a.y, b.x, b.y);
      }
      if (e.type === 'cake-complete') {
        const c = this.cellCenter(e.cell);
        g.lineStyle(4, 0xe0a030, 1);
        g.strokeCircle(c.x, c.y, plateR + 8);
      }
    }
  }

  private arrow(
    g: Phaser.GameObjects.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): void {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const r = this.layout.plateR * 0.55;
    const sx = x1 + Math.cos(ang) * r;
    const sy = y1 + Math.sin(ang) * r;
    const ex = x2 - Math.cos(ang) * r;
    const ey = y2 - Math.sin(ang) * r;
    g.lineStyle(3, 0x1f6f43, 0.95);
    g.lineBetween(sx, sy, ex, ey);
    g.fillStyle(0x1f6f43, 0.95);
    g.fillTriangle(
      ex,
      ey,
      ex - Math.cos(ang - 0.45) * 9,
      ey - Math.sin(ang - 0.45) * 9,
      ex - Math.cos(ang + 0.45) * 9,
      ey - Math.sin(ang + 0.45) * 9,
    );
  }

  // ---- effects (cosmetic only; state is already final) ------------------------------------

  private clearFx(): void {
    for (const o of this.fx) o.destroy();
    this.fx = [];
  }

  private playEffects(result: EngineResult): void {
    const k = this.speed();
    const maxDepth = result.analysis.chainDepth;
    sfx.place();
    if (k === 0) {
      if (result.analysis.cakesCompleted > 0) sfx.cake(maxDepth);
      return;
    }
    let delay = 0;
    for (const e of result.events) {
      if (e.type === 'transfer') {
        delay += 110 * k;
        this.flyDot(e.fromCell, e.toCell, e.flavor, delay, 220 * k);
        this.time.delayedCall(delay, () => sfx.transfer());
      } else if (e.type === 'cake-complete') {
        delay += 160 * k;
        this.burst(e.cell, e.flavor, delay);
        this.time.delayedCall(delay, () => sfx.cake(e.depth));
      }
    }
    const label = chainLabel(maxDepth, this.lang);
    if (label) this.popText(label, delay + 120 * k);
    if (result.nextState.status === 'won') this.time.delayedCall(delay + 300 * k, () => sfx.win());
    else if (result.nextState.status === 'lost') {
      this.time.delayedCall(delay + 300 * k, () => sfx.lose());
    }
  }

  private flyDot(from: number, to: number, flavor: number, delay: number, dur: number): void {
    const a = this.cellCenter(from);
    const b = this.cellCenter(to);
    const color = this.flavors[flavor]?.color ?? 0xffffff;
    const dot = this.add.circle(a.x, a.y, 7, color).setStrokeStyle(2, 0xffffff).setAlpha(0);
    this.fx.push(dot);
    this.tweens.add({
      targets: dot,
      x: b.x,
      y: b.y,
      alpha: { from: 1, to: 1 },
      delay,
      duration: dur,
      ease: 'Sine.easeInOut',
      onStart: () => dot.setAlpha(1),
      onComplete: () => dot.destroy(),
    });
  }

  private burst(cell: number, flavor: number, delay: number): void {
    const c = this.cellCenter(cell);
    const color = this.flavors[flavor]?.color ?? 0xffffff;
    const ring = this.add
      .circle(c.x, c.y, this.layout.plateR * 0.6, color, 0.5)
      .setStrokeStyle(3, 0xffffff)
      .setAlpha(0);
    this.fx.push(ring);
    this.tweens.add({
      targets: ring,
      scale: 1.9,
      alpha: { from: 0.9, to: 0 },
      delay,
      duration: 380,
      onStart: () => ring.setAlpha(0.9),
      onComplete: () => ring.destroy(),
    });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const crumb = this.add.circle(c.x, c.y, 3, i % 2 ? 0xffd166 : color).setAlpha(0);
      this.fx.push(crumb);
      this.tweens.add({
        targets: crumb,
        x: c.x + Math.cos(ang) * this.layout.cs * 0.7,
        y: c.y + Math.sin(ang) * this.layout.cs * 0.7,
        delay,
        duration: 420,
        onStart: () => crumb.setAlpha(1),
        alpha: 0,
        onComplete: () => crumb.destroy(),
      });
    }
  }

  private popText(text: string, delay: number): void {
    const { height } = this.layout;
    const label = this.add
      .text(LOGICAL_WIDTH / 2, height * 0.4, text, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#a85a00',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.fx.push(label);
    this.tweens.add({
      targets: label,
      alpha: { from: 1, to: 0 },
      y: label.y - 30,
      delay,
      duration: 900,
      onStart: () => label.setAlpha(1),
      onComplete: () => label.destroy(),
    });
  }
}

/** Plain-text board description for screen readers. */
export function describeBoard(state: GameState, flavorNames: string[], lang: 'en' | 'hr'): string {
  const rows: string[] = [];
  for (let r = 0; r < state.rows; r++) {
    const cells: string[] = [];
    for (let c = 0; c < state.columns; c++) {
      const idx = r * state.columns + c;
      if (!state.playable[idx]) continue;
      const p = state.board[idx];
      cells.push(p ? describePlate(p.slices, flavorNames) : t(lang, 'empty'));
    }
    rows.push(`${r + 1}: ${cells.join(', ')}`);
  }
  return rows.join('. ');
}

export function describePlate(slices: readonly number[], flavorNames: string[]): string {
  const counts = new Map<number, number>();
  for (const f of slices) counts.set(f, (counts.get(f) ?? 0) + 1);
  return [...counts.entries()].map(([f, n]) => `${flavorNames[f] ?? f} ${n}`).join(' ');
}

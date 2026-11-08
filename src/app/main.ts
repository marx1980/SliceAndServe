import Phaser from 'phaser';
import './style.css';
import { GameSession } from './session';
import {
  BoardScene,
  describeBoard,
  describePlate,
  type HintMarks,
} from '../game/scenes/BoardScene';
import { FLAVORS } from '../content/flavors';
import { LEVELS } from '../content/levels';
import receiptsJson from '../content/receipts.json';
import { setVolume } from '../ui/sound';
import { t } from '../ui/strings';
import { applyCommand } from '../game/rules/engine';
import { applyAny, isToolCommand } from '../game/rules/apply';
import { compareMoves, explainMove, type HintData } from '../game/analysis/hints';
import type { FailureReport } from '../game/analysis/failure';
import { receiptStatus, type Receipt } from '../game/analysis/receipt';
import { requestFailure, requestHints } from '../game/analysis/client';
import type { EngineResult, GameState, OrderSpec, PlacePlateCommand } from '../game/model/types';
import { hatCount, exportSaves, importSaves } from '../save/storage';
import type { AnimationSpeed, Language, PlateTheme, TrayModeSetting } from '../save/storage';
import { buildBakery, buildRecipes, goalLabel, showEnding, showStory } from './panels';
import { createToolsUi } from './toolsUi';
import { addRescue, buildModes, MODES } from './modes';
import { lastRescuableIndex, rescueFromState } from '../game/modes/rescue';
import type { LevelDefinition, ModeId } from '../game/model/types';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

const session = new GameSession();
setVolume(session.settings.soundVolume);
let ready = false;
let resultTimer: number | undefined;
let lastPreview: EngineResult | null = null;
let pendingEffects: EngineResult | null = null;

const lang = (): Language => session.settings.language;
const L = (key: string): string => t(lang(), key);
const flavorName = (id: string): string => {
  const f = FLAVORS[id];
  return f ? f.name[lang()] : id;
};
const flavorNames = (): string[] => session.level.flavors.map(flavorName);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const animFactor = (): number =>
  session.settings.animation === 'off' ? 0 : session.settings.animation === 'fast' ? 0.5 : 1;

// ---- scene ---------------------------------------------------------------------------------

const scene = new BoardScene(session, {
  onChange: (preview, slot) => {
    lastPreview = preview;
    updateHud(slot);
  },
  onMove: (result) => {
    announceMove(result);
    teachAfterMove(result);
  },
});

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'stage',
  transparent: true,
  width: 360,
  height: 520,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [scene],
  audio: { noAudio: true },
  callbacks: {
    postBoot: () => {
      ready = true;
    },
  },
});

const tools = createToolsUi(session, scene, document.getElementById('tools') as HTMLElement);

// ---- HUD -----------------------------------------------------------------------------------

function orderLabel(spec: OrderSpec): { swatch?: number; text: string } {
  switch (spec.kind) {
    case 'complete-flavor': {
      const id = session.level.flavors[spec.flavor] ?? '';
      return { swatch: FLAVORS[id]?.color, text: flavorName(id) };
    }
    case 'complete-any':
      return { text: L('cakes') };
    case 'complete-distinct':
      return { text: L('distinct') };
    case 'chain':
      return { text: L('chain') };
  }
}

function renderQueue(): void {
  const q = $('queue');
  const state = session.state;
  const fixed = session.level.layout !== undefined;
  q.hidden = !fixed;
  q.replaceChildren();
  if (!fixed) return;
  q.setAttribute('aria-label', L('queueLeft'));
  for (const plate of state.queue.slice(state.queueIndex)) {
    const chip = document.createElement('span');
    chip.className = 'qplate';
    chip.title = describePlate(plate.slices, flavorNames());
    for (const f of plate.slices) {
      const dot = document.createElement('i');
      const id = session.level.flavors[f] ?? '';
      dot.style.background = `#${(FLAVORS[id]?.color ?? 0x888888).toString(16).padStart(6, '0')}`;
      chip.appendChild(dot);
    }
    q.appendChild(chip);
  }
}

function updateHud(selectedSlot: number | null): void {
  const state = session.state;
  const mode = session.mode;
  $('level-title').textContent =
    mode === 'campaign'
      ? `${session.level.id.replace('L', '')}. ${session.level.title}`
      : mode === 'endless'
        ? `${L('endless')} ${L('stage')} ${session.endless.stage}`
        : `${L(mode === 'recipe' ? 'recipe' : mode)} ${session.level.title}`;
  $('v-moves').textContent = `${L('moves')} ${state.moveNumber}`;
  $('v-target').textContent =
    mode === 'campaign' ? `${L('target')} ${session.level.moveTarget}` : '';
  $('v-score').textContent =
    mode === 'zen'
      ? ''
      : `${L('score')} ${mode === 'endless' ? session.endless.banked + state.score : state.score}`;
  $('v-goal').textContent =
    mode === 'pass'
      ? `${L('player')} ${session.passPlayer() + 1}`
      : session.level.mastery && mode === 'campaign'
        ? `★ ${goalLabel(lang(), session.level.mastery)}`
        : '';
  renderQueue();

  const list = $('orders');
  list.replaceChildren();
  state.orders.forEach((spec, i) => {
    const progress = state.orderProgress[i];
    if (!progress) return;
    const previewProgress = lastPreview?.nextState.orderProgress[i];
    const gain = previewProgress ? previewProgress.value - progress.value : 0;
    const li = document.createElement('li');
    li.className = `order${progress.complete ? ' done' : ''}`;
    const label = orderLabel(spec);
    if (label.swatch !== undefined) {
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = `#${label.swatch.toString(16).padStart(6, '0')}`;
      li.appendChild(sw);
    }
    const text = document.createElement('span');
    text.textContent = `${label.text} ${progress.value}/${progress.target}`;
    li.appendChild(text);
    if (gain > 0) {
      const d = document.createElement('span');
      d.className = 'delta';
      d.textContent = `+${gain}`;
      li.appendChild(d);
    }
    list.appendChild(li);
  });

  tools.render();
  $('btn-undo').toggleAttribute('disabled', !session.history.canUndo());
  $('btn-hint').toggleAttribute('disabled', state.status !== 'playing');
  $('btn-place').toggleAttribute(
    'disabled',
    !(lastPreview && selectedSlot !== null && state.status === 'playing'),
  );

  const sr = describeBoard(state, flavorNames(), lang());
  const trayText = state.tray
    .map((p, i) => (p ? `${i + 1}: ${describePlate(p.slices, flavorNames())}` : null))
    .filter(Boolean)
    .join('. ');
  $('stage').setAttribute('role', 'application');
  $('stage').setAttribute('aria-label', `${L('board')}. ${sr}. ${L('tray')}. ${trayText}`);
  if (!$('timeline').hidden) buildTimeline();
}

function announceMove(result: EngineResult): void {
  const a = result.analysis;
  const parts = [`${L('moves')} ${result.nextState.moveNumber}`];
  if (a.cakesCompleted > 0) parts.push(`${L('cakes')} ${a.cakesCompleted}`);
  if (a.chainDepth > 1) parts.push(`${L('chain')} ${a.chainDepth}`);
  $('sr-status').textContent = parts.join('. ');
  scheduleResult();
}

function applyStrings(): void {
  document.documentElement.lang = lang();
  const set = (id: string, key: string): void => {
    $(id).textContent = L(key);
  };
  set('btn-menu', 'menu');
  set('btn-undo', 'undo');
  set('btn-hint', 'hint');
  set('btn-place', 'place');
  set('btn-restart', 'restart');
  set('menu-title', 'levels');
  set('menu-fair', 'fairBake');
  set('menu-recipes', 'recipes');
  set('menu-modes', 'modes');
  set('modes-close', 'close');
  set('menu-bakery', 'bakery');
  set('recipes-close', 'close');
  set('bakery-close', 'close');
  set('menu-close', 'close');
  set('settings-title', 'settings');
  set('settings-close', 'close');
  set('timeline-title', 'timeline');
  set('timeline-close', 'close');
  set('tl-undo', 'undo');
  set('tl-redo', 'redo');
  set('tl-bookmark', 'bookmark');
  set('fair-title', 'fairBake');
  set('fair-close', 'close');
  for (const [id, key] of [
    ['btn-timeline', 'timeline'],
    ['btn-settings', 'settings'],
  ] as const) {
    $(id).setAttribute('aria-label', L(key));
    $(id).setAttribute('title', L(key));
  }
  $('timeline-range').setAttribute('aria-label', L('timeline'));
  $('timeline').setAttribute('aria-label', L('timeline'));
  if (!replaying) set('tl-replay', 'watch');
}

// ---- helpers for text ----------------------------------------------------------------------

function moveText(plate: readonly number[] | null, cmd: PlacePlateCommand): string {
  const where = `${cmd.row + 1},${cmd.column + 1}`;
  return plate ? `${describePlate(plate, flavorNames())} → ${where}` : where;
}

function rowsList(
  into: HTMLElement,
  rows: Array<{ label: string; values: string[] }>,
  header?: string[],
): void {
  into.replaceChildren();
  into.classList.toggle('three', (rows[0]?.values.length ?? 1) > 1);
  const add = (label: string, values: string[]): void => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    into.appendChild(dt);
    for (const v of values) {
      const dd = document.createElement('dd');
      dd.textContent = v;
      into.appendChild(dd);
    }
  };
  if (header) add('', header);
  for (const r of rows) add(r.label, r.values);
}

function button(text: string, onClick: () => void, cls = 'btn'): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

const verdictLabel = (v: string): string =>
  v === 'win' ? L('win') : v === 'no-win' ? L('noWin') : v === 'unknown' ? L('unknown') : v;

// ---- coach bar: hints, demonstration and Teach Me ------------------------------------------

interface HintSession {
  state: GameState;
  data: HintData;
  rung: number;
}
let hint: HintSession | null = null;
let hintToken = 0;
let demoRunning = false;
let demoCancel = false;
const teachCache = new WeakMap<GameState, Promise<HintData>>();

function coach(): HTMLElement {
  return $('coach');
}

function closeCoach(): void {
  if (demoRunning) return;
  hintToken++;
  hint = null;
  coach().hidden = true;
  coach().replaceChildren();
  scene.setHintMarks(null);
}

function coachHead(title: string, badge?: { text: string; dead?: boolean }): HTMLElement {
  const head = document.createElement('div');
  head.className = 'coach-head';
  const strong = document.createElement('strong');
  strong.textContent = title;
  head.appendChild(strong);
  if (badge) {
    const b = document.createElement('span');
    b.className = `badge${badge.dead ? ' dead' : ''}`;
    b.textContent = badge.text;
    head.appendChild(b);
  }
  return head;
}

function startHint(): void {
  if (session.state.status !== 'playing') return;
  if (hint && hint.state === session.state) {
    moreHint();
    return;
  }
  const state = session.state;
  const token = ++hintToken;
  coach().hidden = false;
  coach().replaceChildren(coachHead(`${L('hint')} ${L('analyzing')}`));
  void requestHints(state).then((data) => {
    if (token !== hintToken || session.state !== state) return;
    hint = { state, data, rung: 1 };
    renderHint();
  });
}

function moreHint(): void {
  if (!hint || hint.data.certainty === 'dead' || hint.rung >= 6) return;
  hint.rung++;
  renderHint();
}

function renderHint(): void {
  if (!hint) return;
  const { state, data, rung } = hint;
  const el = coach();
  el.hidden = false;
  el.replaceChildren();

  if (data.certainty === 'dead' || !data.best) {
    const head = coachHead(L('hint'), { text: L('dead'), dead: true });
    head.appendChild(button(L('close'), closeCoach));
    el.appendChild(head);
    scene.setHintMarks(null);
    return;
  }

  const badge = data.certainty === 'confirmed' ? L('confirmed') : L('heuristic');
  const head = coachHead(`${L('hint')} ${rung}/6`, { text: badge });
  if (rung < 6) head.appendChild(button(L('more'), moreHint));
  head.appendChild(button(L('close'), closeCoach));
  el.appendChild(head);

  const best = data.best;
  const cellOf = (c: PlacePlateCommand): number => c.row * state.columns + c.column;
  const marks: HintMarks = { cells: [], slot: null, target: null, sequence: [] };
  if (rung === 1) marks.cells = data.cells.slice(0, 3);
  else if (rung === 2) marks.cells = data.cells.slice(0, 2);
  else if (rung <= 4) {
    marks.slot = best.cmd.slot;
    marks.target = cellOf(best.cmd);
  } else {
    marks.slot = best.cmd.slot;
    data.line.slice(0, 2).forEach((c, i) => marks.sequence.push({ cell: cellOf(c), n: i + 1 }));
  }
  scene.setHintMarks(marks);

  if (rung >= 4) {
    const rows = explainMove(state, best, data).map((r) => ({
      label: L(r.key),
      values: [r.value],
    }));
    const dl = document.createElement('dl');
    dl.className = 'rows';
    rowsList(dl, rows);
    el.appendChild(dl);
  }
  if (rung >= 5) {
    const dl = document.createElement('dl');
    dl.className = 'rows';
    let s = state;
    const seq: Array<{ label: string; values: string[] }> = [];
    for (const [i, c] of data.line.slice(0, 2).entries()) {
      seq.push({ label: String(i + 1), values: [moveText(s.tray[c.slot]?.slices ?? null, c)] });
      s = applyCommand(s, c).nextState;
      if (s.status !== 'playing') break;
    }
    rowsList(dl, seq);
    el.appendChild(dl);
  }
  if (rung === 6) {
    el.appendChild(button(L('showSolution'), () => void demonstrate(data.line), 'btn primary'));
  }
}

/** Plays a line on the board as a new branch; the player can stop or rewind at any time. */
async function demonstrate(line: PlacePlateCommand[]): Promise<void> {
  if (demoRunning) return;
  demoRunning = true;
  demoCancel = false;
  const el = coach();
  el.replaceChildren();
  const head = coachHead(L('showSolution'));
  head.appendChild(
    button(L('stop'), () => {
      demoCancel = true;
    }),
  );
  el.appendChild(head);
  scene.setHintMarks(null);
  for (const cmd of line) {
    if (demoCancel || session.state.status !== 'playing') break;
    scene.playCommand(cmd);
    await sleep(Math.max(250, 800 * animFactor()));
  }
  demoRunning = false;
  closeCoach();
}

function prefetchTeach(state: GameState): void {
  if (!session.settings.teachMe || state.status !== 'playing' || teachCache.has(state)) return;
  teachCache.set(state, requestHints(state));
}

function teachAfterMove(result: EngineResult): void {
  if (!session.settings.teachMe || demoRunning) return;
  const before = result.previousState;
  const played = session.history.moves.at(-1);
  if (!played || isToolCommand(played)) return;
  const pending = teachCache.get(before) ?? requestHints(before);
  void pending.then((data) => {
    if (session.state !== result.nextState) return;
    const cmp = compareMoves(before, played, data.evals);
    const el = coach();
    el.hidden = false;
    el.replaceChildren();
    const head = coachHead(L('teachMe'), {
      text: cmp.matchesBest ? L('matches') : L('differs'),
      dead: !cmp.matchesBest,
    });
    head.appendChild(button(L('close'), closeCoach));
    el.appendChild(head);
    const dl = document.createElement('dl');
    dl.className = 'rows';
    rowsList(
      dl,
      cmp.rows.map((r) => ({
        label: L(r.key),
        values: [
          r.key === 'verdict' ? verdictLabel(r.chosen) : r.chosen,
          r.key === 'verdict' ? verdictLabel(r.best) : r.best,
        ],
      })),
      [L('you'), L('best')],
    );
    el.appendChild(dl);
    prefetchTeach(result.nextState);
  });
}

// ---- overlays ------------------------------------------------------------------------------

function show(id: string, on: boolean): void {
  $(id).hidden = !on;
}

function hats(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));
}

function buildMenu(): void {
  const grid = $('level-grid');
  grid.replaceChildren();
  for (const level of LEVELS) {
    const p = session.progress.levels[level.id];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn level-btn';
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = level.id.replace('L', '');
    const title = document.createElement('span');
    title.textContent = level.title;
    const h = document.createElement('span');
    h.className = 'hats';
    h.textContent = hats(hatCount(p));
    b.append(num, title, h);
    b.addEventListener('click', () => {
      show('menu', false);
      startLevel(level.id);
    });
    grid.appendChild(b);
  }
}

function segmented<T extends string>(
  parent: HTMLElement,
  labelKey: string,
  options: Array<[T, string]>,
  current: T,
  onPick: (v: T) => void,
): void {
  const row = document.createElement('div');
  row.className = 'row';
  const label = document.createElement('label');
  label.textContent = L(labelKey);
  const seg = document.createElement('div');
  seg.className = 'seg';
  for (const [value, key] of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = L(key);
    b.setAttribute('aria-pressed', String(value === current));
    b.addEventListener('click', () => onPick(value));
    seg.appendChild(b);
  }
  row.append(label, seg);
  parent.appendChild(row);
}

function buildSettings(): void {
  const body = $('settings-body');
  body.replaceChildren();
  const s = session.settings;
  segmented<TrayModeSetting>(
    body,
    'tray',
    [
      ['slot', 'slot'],
      ['batch', 'batch'],
    ],
    s.trayMode,
    (v) => {
      session.updateSettings({ trayMode: v });
      buildSettings();
    },
  );
  segmented<AnimationSpeed>(
    body,
    'animation',
    [
      ['normal', 'normal'],
      ['fast', 'fast'],
      ['off', 'off'],
    ],
    s.animation,
    (v) => {
      session.updateSettings({ animation: v });
      buildSettings();
    },
  );
  segmented<'on' | 'off'>(
    body,
    'confirm',
    [
      ['on', 'on'],
      ['off', 'off'],
    ],
    s.confirmPlacement ? 'on' : 'off',
    (v) => {
      session.updateSettings({ confirmPlacement: v === 'on' });
      buildSettings();
    },
  );
  segmented<'on' | 'off'>(
    body,
    'teachMe',
    [
      ['on', 'on'],
      ['off', 'off'],
    ],
    s.teachMe ? 'on' : 'off',
    (v) => {
      session.updateSettings({ teachMe: v === 'on' });
      if (v === 'on') prefetchTeach(session.state);
      buildSettings();
    },
  );
  segmented<'on' | 'off'>(
    body,
    'skipDialogue',
    [
      ['on', 'on'],
      ['off', 'off'],
    ],
    s.skipDialogue ? 'on' : 'off',
    (v) => {
      session.updateSettings({ skipDialogue: v === 'on' });
      buildSettings();
    },
  );
  segmented<PlateTheme>(
    body,
    'plateTheme',
    [
      ['classic', 'classic'],
      ['pastel', 'pastel'],
    ],
    s.plateTheme,
    (v) => {
      session.updateSettings({ plateTheme: v });
      scene.refresh();
      buildSettings();
    },
  );
  segmented<Language>(
    body,
    'language',
    [
      ['en', 'EN'],
      ['hr', 'HR'],
    ],
    s.language,
    (v) => {
      session.updateSettings({ language: v });
      refreshAll();
    },
  );
  const row = document.createElement('div');
  row.className = 'row';
  const label = document.createElement('label');
  label.textContent = L('sound');
  const range = document.createElement('input');
  range.type = 'range';
  range.min = '0';
  range.max = '100';
  range.value = String(Math.round(s.soundVolume * 100));
  range.setAttribute('aria-label', L('sound'));
  range.addEventListener('input', () => {
    const v = Number(range.value) / 100;
    setVolume(v);
    session.updateSettings({ soundVolume: v });
  });
  row.append(label, range);
  body.appendChild(row);

  const saves = document.createElement('div');
  saves.className = 'row';
  const savesLabel = document.createElement('label');
  savesLabel.textContent = L('saves');
  const box = document.createElement('div');
  box.className = 'seg';
  box.appendChild(
    button(L('exportSaves'), () => {
      const url = URL.createObjectURL(new Blob([exportSaves()], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: 'sliceandserve-saves.json',
      });
      a.click();
      URL.revokeObjectURL(url);
    }),
  );
  const file = Object.assign(document.createElement('input'), {
    type: 'file',
    accept: 'application/json',
    hidden: true,
  });
  file.addEventListener('change', () => {
    void file.files?.[0]?.text().then((text) => {
      if (importSaves(text)) location.reload();
    });
  });
  box.append(
    button(L('importSaves'), () => file.click()),
    file,
  );
  saves.append(savesLabel, box);
  body.appendChild(saves);
}

// ---- timeline ------------------------------------------------------------------------------

let storyShown = false;
let replaying = false;
let replayCancel = false;

function buildTimeline(): void {
  const h = session.history;
  const max = h.length - 1;
  const range = $<HTMLInputElement>('timeline-range');
  range.max = String(max);
  range.value = String(h.position);
  $('timeline-pos').textContent = `${L('move')} ${h.position} / ${max}`;
  $('tl-undo').toggleAttribute('disabled', !h.canUndo());
  $('tl-redo').toggleAttribute('disabled', !h.canRedo());
  const marked = h.pathTo(h.cursorId).at(-1)?.bookmark ?? false;
  $('tl-bookmark').setAttribute('aria-pressed', String(marked));

  const marks = $('tl-bookmarks');
  marks.replaceChildren();
  for (const n of h.bookmarks()) {
    marks.appendChild(button(`★ ${n.depth}`, () => session.goToNode(n.id)));
  }
  const branches = $('tl-branches');
  branches.replaceChildren();
  h.branches().forEach((b, i) => {
    const mark = b.status === 'won' ? ' ✓' : b.status === 'lost' ? ' ✗' : '';
    const btn = button(`${i + 1}: ${b.moves}${mark}`, () => session.switchBranch(b.id));
    btn.setAttribute('aria-pressed', String(b.active));
    btn.setAttribute('aria-label', `${L('branches')} ${i + 1}`);
    branches.appendChild(btn);
  });
  $('tl-replay').textContent = replaying ? L('stop') : L('watch');
}

/** Steps through the active branch from the start; the timeline is untouched. */
async function replayActive(): Promise<void> {
  if (replaying) {
    replayCancel = true;
    return;
  }
  replaying = true;
  replayCancel = false;
  closeCoach();
  const path = session.history.activePath();
  session.seek(0);
  for (let i = 1; i < path.length && !replayCancel; i++) {
    await sleep(Math.max(250, 800 * animFactor()));
    if (replayCancel) break;
    const prev = path[i - 1];
    const next = path[i];
    if (!prev || !next || !next.command) break;
    pendingEffects = applyAny(prev.state, next.command);
    session.seek(i);
  }
  replaying = false;
  if (!$('timeline').hidden) buildTimeline();
}

// ---- result and failure analysis -----------------------------------------------------------

function scheduleResult(): void {
  window.clearTimeout(resultTimer);
  if (session.state.status === 'playing') return;
  resultTimer = window.setTimeout(showResult, 500 + 700 * animFactor());
}

function failureRows(
  report: FailureReport,
  state: GameState,
): Array<{ label: string; values: string[] }> {
  const rows: Array<{ label: string; values: string[] }> = [];
  if (report.lastWinningIndex === null) return rows;
  const states = session.history.statesToCursor();
  const at = states[report.lastWinningIndex] ?? state;
  rows.push({ label: L('lastWinning'), values: [`${L('move')} ${report.lastWinningIndex}`] });
  if (!report.conclusive) rows.push({ label: L('bestKnown'), values: ['~'] });
  if (report.criticalMove) {
    rows.push({
      label: L('closingMove'),
      values: [
        moveText(
          at.tray[report.criticalMove.slot]?.slices ?? report.criticalPlate,
          report.criticalMove,
        ),
      ],
    });
  }
  rows.push({ label: L('afterClosing'), values: [String(report.movesAfterCritical)] });
  if (report.fragmented) {
    const id = session.level.flavors[report.fragmented.flavor] ?? '';
    rows.push({
      label: L('spread'),
      values: [`${flavorName(id)} × ${report.fragmented.plates}`],
    });
  }
  if (report.missedCompletion) {
    rows.push({
      label: L('missed'),
      values: [moveText(report.missedCompletion.plate, report.missedCompletion.cmd)],
    });
  }
  if (report.alternative) {
    rows.push({
      label: L('alternative'),
      values: [moveText(report.alternative.plate, report.alternative.cmd)],
    });
  }
  return rows;
}

/** The next fixed puzzle after the current recipe challenge or rescue board, if any. */
function nextSibling(): LevelDefinition | null {
  const list =
    session.mode === 'recipe' ? MODES.recipes : session.mode === 'rescue' ? MODES.rescue : [];
  const i = list.findIndex((l) => l.id === session.level.id);
  return i >= 0 ? (list[i + 1] ?? null) : null;
}

/** Walks the finished timeline back to the last position the solver can still win from. */
async function convertToRescue(): Promise<void> {
  const states = session.history.statesToCursor();
  const idx = lastRescuableIndex(states);
  const note = $('result-analysis');
  if (idx === null) {
    rowsList(note, [{ label: L('nothingToRescue'), values: [''] }]);
    return;
  }
  const level = rescueFromState(
    states[idx] as GameState,
    session.level,
    `X${Date.now().toString(36)}`,
    `${session.progress.modes.rescues.length + 1}`,
  );
  const code = addRescue(session, level);
  show('result', false);
  openModes(code);
}

function showResult(): void {
  const state = session.state;
  if (state.status === 'playing') return;
  if (state.status === 'won' && !storyShown) {
    storyShown = true;
    showStory(session, session.pendingDialogue('after'), showResult);
    return;
  }
  storyShown = false;
  $('result-title').textContent =
    state.status === 'won'
      ? L('complete')
      : session.mode === 'zen'
        ? L('stuck')
        : state.tray.every((p) => p === null) && state.board.some((p) => p === null)
          ? L('noPlates')
          : L('noSpace');
  const values = $('result-values');
  values.replaceChildren();
  const add = (text: string, cls?: string): void => {
    const s = document.createElement('span');
    s.textContent = text;
    if (cls) s.className = cls;
    values.appendChild(s);
  };
  if (state.status === 'won' && session.mode !== 'campaign') {
    const w = session.winStats();
    add(`${L('moves')} ${w.moves}`);
    if (session.mode === 'endless') {
      add(`${L('stage')} ${session.endless.stage}`);
      add(`${L('score')} ${session.endless.banked + w.score}`);
    } else if (session.mode === 'pass') {
      const ps = session.passStats();
      ps.forEach((p, i) =>
        add(`${L('player')} ${i + 1}: ${L('cakes')} ${p.cakes} · ${L('score')} ${p.score}`),
      );
    } else if (session.mode !== 'zen') {
      add(`${L('score')} ${w.score}`);
      add(`${L('chain')} ${w.chain}`);
      add(`${L('peak')} ${w.peak}`);
    }
  } else if (state.status === 'won') {
    const earned = session.hatsFor(state);
    add(hats(1 + (earned.moves ? 1 : 0) + (earned.mastery ? 1 : 0)), 'hats-big');
    add(
      `${L('hatMoves')} ${state.moveNumber}/${session.level.moveTarget} ${earned.moves ? '✓' : '✗'}`,
    );
    if (session.level.mastery) {
      add(
        `${L('hatMastery')} ${goalLabel(lang(), session.level.mastery)} ${earned.mastery ? '✓' : '✗'}`,
      );
    }
  }
  if (session.mode === 'campaign' || state.status !== 'won') {
    add(`${L('moves')} ${state.moveNumber}`);
    if (session.mode !== 'zen') add(`${L('score')} ${state.score}`);
  }

  const analysis = $('result-analysis');
  analysis.replaceChildren();
  const actions = $('result-actions');
  actions.replaceChildren();
  const act = (key: string, fn: () => void, primary = false, front = false): void => {
    const b = button(
      L(key),
      () => {
        show('result', false);
        fn();
      },
      `btn${primary ? ' primary' : ''}`,
    );
    if (front) actions.prepend(b);
    else actions.appendChild(b);
  };
  if (state.status === 'won') {
    const next = session.nextLevelId();
    if (next) act('next', () => startLevel(next), true);
    if (session.mode === 'endless') act('next', () => session.nextEndless(), true);
    const sibling = nextSibling();
    if (sibling) act('next', () => startMode(sibling, session.mode), true);
    act('watch', () => void replayActive());
    act('replay', () => session.restart());
  } else {
    act('explore', () => undefined, true);
    act('restart', () => session.restart());
    if (session.mode !== 'zen') act('toRescue', () => void convertToRescue());
    // Failure analysis runs in a worker; the neutral summary appears when it is ready.
    const states = session.history.statesToCursor();
    const moves = [...session.history.moves];
    const placements = moves.filter((m): m is PlacePlateCommand => !isToolCommand(m));
    const analysable = placements.length === moves.length;
    if (analysable && session.mode !== 'zen')
      analysis.appendChild(
        Object.assign(document.createElement('dt'), { textContent: L('analyzing') }),
      );
    if (analysable && session.mode !== 'zen')
      void requestFailure(states, placements).then((report) => {
        if (session.state !== state || $('result').hidden) return;
        rowsList(analysis, failureRows(report, state));
        const idx = report.lastWinningIndex;
        if (idx !== null) {
          if (report.alternative) {
            const alt = report.alternative.cmd;
            actions.prepend(
              button(L('watchAlt'), () => {
                show('result', false);
                session.seek(idx);
                window.setTimeout(() => scene.playCommand(alt), 300);
              }),
            );
          }
          actions.prepend(
            button(
              `${L('retry')} ${idx}`,
              () => {
                show('result', false);
                session.seek(idx);
              },
              'btn primary',
            ),
          );
        }
      });
  }
  act('menu', () => openMenu());
  if (session.mode !== 'campaign') act('modes', () => openModes());
  if (
    session.mode === 'campaign' &&
    state.status === 'won' &&
    session.level.id === LEVELS[LEVELS.length - 1]?.id &&
    !session.progress.endingSeen
  ) {
    session.markEndingSeen();
    show('result', false);
    showEnding(session);
    return;
  }
  show('result', true);
  (actions.firstElementChild as HTMLElement | null)?.focus();
}

// ---- Fair Bake -----------------------------------------------------------------------------

function buildFair(): void {
  const level = session.level;
  const mode = session.state.ruleset.trayMode;
  const receipt = (receiptsJson as Receipt[]).find(
    (r) => r.levelId === level.id && r.trayMode === mode,
  );
  const status = receiptStatus(level, receipt);
  if (session.mode !== 'campaign') {
    const checked =
      session.mode === 'daily' ||
      session.mode === 'recipe' ||
      (session.mode === 'rescue' && MODES.rescue.some((r) => r.id === level.id));
    rowsList($('fair-rows'), [
      { label: L('mode'), values: [L(session.mode === 'recipe' ? 'recipe' : session.mode)] },
      { label: L('levelId'), values: [level.id] },
      { label: L('seed'), values: [level.generation.seed] },
      { label: L('trayModel'), values: [L(mode)] },
      { label: L('status'), values: [L(checked ? 'verified' : 'unverified')] },
      { label: L('flavourCount'), values: [String(level.flavors.length)] },
      { label: L('plates'), values: [String(session.state.board.filter(Boolean).length)] },
      { label: L('sequence'), values: [L('fixed')] },
      { label: L('randomness'), values: [L('none')] },
    ]);
    return;
  }
  const rows: Array<{ label: string; values: string[] }> = [
    { label: L('levelId'), values: [level.id] },
    { label: L('seed'), values: [level.generation.seed] },
    { label: L('trayModel'), values: [L(mode)] },
    { label: L('status'), values: [L(status)] },
  ];
  if (receipt) {
    rows.push({
      label: L('knownRoutes'),
      values: [`${receipt.exact ? '' : '≥ '}${receipt.routes}`],
    });
    rows.push({
      label: L('viableFirst'),
      values: [`${receipt.viableFirstMoves}/${receipt.firstMoves}`],
    });
    rows.push({
      label: receipt.exact ? L('shortestMoves') : L('solutionMoves'),
      values: [String(receipt.shortest ?? receipt.solution.length)],
    });
  }
  rows.push({ label: L('sequence'), values: [L('fixed')] });
  rows.push({ label: L('randomness'), values: [L('none')] });
  rowsList($('fair-rows'), rows);
}

function openMenu(): void {
  buildMenu();
  show('menu', true);
  ($('level-grid').firstElementChild as HTMLElement | null)?.focus();
}

function startLevel(id: string): void {
  show('result', false);
  closeCoach();
  tools.cancel();
  session.startLevel(id);
  showStory(session, session.pendingDialogue('before'), () => undefined);
}

function startMode(level: LevelDefinition, mode: ModeId): void {
  show('modes', false);
  show('result', false);
  closeCoach();
  tools.cancel();
  session.startPuzzle(level, mode);
}

function refreshAll(): void {
  applyStrings();
  buildMenu();
  buildSettings();
  updateHud(null);
}

// ---- wiring --------------------------------------------------------------------------------

session.subscribe((e) => {
  if (!ready) return;
  if (e.kind === 'settings') {
    updateHud(null);
    return;
  }
  show('result', false);
  window.clearTimeout(resultTimer);
  if (!demoRunning) closeCoach();
  if (e.kind !== 'move') tools.cancel();
  if (e.kind === 'move' && e.result?.events[0]?.type === 'tool') announceMove(e.result);
  if (e.kind === 'level' || e.kind === 'restart') scene.loadLevel();
  else {
    const effects = pendingEffects ?? undefined;
    pendingEffects = null;
    scene.refresh(effects);
  }
  prefetchTeach(session.state);
});

$('btn-menu').addEventListener('click', openMenu);
$('menu-close').addEventListener('click', () => show('menu', false));
$('menu-fair').addEventListener('click', () => {
  buildFair();
  show('menu', false);
  show('fairbake', true);
});
$('fair-close').addEventListener('click', () => show('fairbake', false));
$('menu-recipes').addEventListener('click', () => {
  buildRecipes(session);
  show('menu', false);
  show('recipes', true);
});
$('menu-bakery').addEventListener('click', () => {
  buildBakery(session, () => undefined);
  show('menu', false);
  show('bakery', true);
});
const modeHandlers = {
  start: startMode,
  startEndless: (seed: string) => {
    show('modes', false);
    show('result', false);
    closeCoach();
    tools.cancel();
    session.startEndless(seed);
  },
  close: () => show('modes', false),
};
function openModes(code?: string): void {
  buildModes(session, modeHandlers, code ? { code } : {});
  show('menu', false);
  show('modes', true);
}
$('menu-modes').addEventListener('click', () => openModes());
$('modes-close').addEventListener('click', () => show('modes', false));
$('recipes-close').addEventListener('click', () => show('recipes', false));
$('bakery-close').addEventListener('click', () => show('bakery', false));
$('btn-settings').addEventListener('click', () => {
  buildSettings();
  show('settings', true);
});
$('settings-close').addEventListener('click', () => show('settings', false));
$('btn-timeline').addEventListener('click', () => {
  buildTimeline();
  show('timeline', true);
});
$('timeline-close').addEventListener('click', () => {
  replayCancel = true;
  show('timeline', false);
});
$<HTMLInputElement>('timeline-range').addEventListener('input', (ev) => {
  replayCancel = true;
  session.seek(Number((ev.target as HTMLInputElement).value));
});
$('tl-undo').addEventListener('click', () => session.undo());
$('tl-redo').addEventListener('click', () => session.redo());
$('tl-bookmark').addEventListener('click', () => session.toggleBookmark());
$('tl-replay').addEventListener('click', () => void replayActive());
$('btn-undo').addEventListener('click', () => session.undo());
$('btn-hint').addEventListener('click', startHint);
$('btn-restart').addEventListener('click', () => session.restart());
$('btn-place').addEventListener('click', () => scene.confirmPreview());
window.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    for (const id of ['menu', 'settings', 'timeline', 'fairbake', 'recipes', 'bakery', 'modes']) {
      if (!$(id).hidden) {
        show(id, false);
        return;
      }
    }
    if (!coach().hidden) closeCoach();
  }
  if (ev.key === 'h' || ev.key === 'H') {
    if (document.activeElement?.tagName !== 'INPUT') startHint();
  }
});

applyStrings();
buildMenu();
buildSettings();
// Read-only hook for end-to-end tests; the e2e query flag also allows playing commands.
const sas: Record<string, unknown> = {
  state: () => session.state,
  level: () => session.level.id,
  history: () => ({
    position: session.history.position,
    length: session.history.length,
    branches: session.history.branches().length,
    bookmarks: session.history.bookmarks().length,
  }),
};
if (new URLSearchParams(location.search).has('e2e')) {
  sas.play = (cmd: PlacePlateCommand) => scene.playCommand(cmd);
  sas.debugStart = (patch: Partial<GameState>) => session.debugStart(patch);
}
(window as unknown as { __sas: unknown }).__sas = sas;
updateHud(null);
prefetchTeach(session.state);
if (session.state.moveNumber === 0)
  showStory(session, session.pendingDialogue('before'), () => undefined);

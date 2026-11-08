import Phaser from 'phaser';
import './style.css';
import { GameSession } from './session';
import { BoardScene, describeBoard, describePlate } from '../game/scenes/BoardScene';
import { FLAVORS } from '../content/flavors';
import { LEVELS } from '../content/levels';
import { setVolume } from '../ui/sound';
import { t } from '../ui/strings';
import type { EngineResult, OrderSpec } from '../game/model/types';
import type { AnimationSpeed, Language, TrayModeSetting } from '../save/storage';

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

const lang = (): Language => session.settings.language;
const flavorName = (id: string): string => {
  const f = FLAVORS[id];
  return f ? f.name[lang()] : id;
};
const flavorNames = (): string[] => session.level.flavors.map(flavorName);

// ---- scene ---------------------------------------------------------------------------------

const scene = new BoardScene(session, {
  onChange: (preview, slot) => {
    lastPreview = preview;
    updateHud(slot);
  },
  onMove: (result) => announceMove(result),
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

// ---- HUD -----------------------------------------------------------------------------------

function orderLabel(spec: OrderSpec): { swatch?: number; text: string } {
  const l = lang();
  switch (spec.kind) {
    case 'complete-flavor': {
      const id = session.level.flavors[spec.flavor] ?? '';
      return { swatch: FLAVORS[id]?.color, text: flavorName(id) };
    }
    case 'complete-any':
      return { text: t(l, 'cakes') };
    case 'complete-distinct':
      return { text: t(l, 'distinct') };
    case 'chain':
      return { text: t(l, 'chain') };
  }
}

function updateHud(selectedSlot: number | null): void {
  const l = lang();
  const state = session.state;
  $('level-title').textContent = `${session.level.id.replace('L', '')}. ${session.level.title}`;
  $('v-moves').textContent = `${t(l, 'moves')} ${state.moveNumber}`;
  $('v-target').textContent = `${t(l, 'target')} ${session.level.moveTarget}`;
  $('v-score').textContent = `${t(l, 'score')} ${state.score}`;

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

  $('btn-undo').toggleAttribute('disabled', !session.history.canUndo());
  $('btn-place').toggleAttribute(
    'disabled',
    !(lastPreview && selectedSlot !== null && state.status === 'playing'),
  );

  const sr = describeBoard(state, flavorNames(), l);
  const trayText = state.tray
    .map((p, i) => (p ? `${i + 1}: ${describePlate(p.slices, flavorNames())}` : null))
    .filter(Boolean)
    .join('. ');
  $('stage').setAttribute('role', 'application');
  $('stage').setAttribute('aria-label', `${t(l, 'board')}. ${sr}. ${t(l, 'tray')}. ${trayText}`);
}

function announceMove(result: EngineResult): void {
  const l = lang();
  const a = result.analysis;
  const parts = [`${t(l, 'moves')} ${result.nextState.moveNumber}`];
  if (a.cakesCompleted > 0) parts.push(`${t(l, 'cakes')} ${a.cakesCompleted}`);
  if (a.chainDepth > 1) parts.push(`${t(l, 'chain')} ${a.chainDepth}`);
  $('sr-status').textContent = parts.join('. ');
  scheduleResult();
}

function applyStrings(): void {
  const l = lang();
  document.documentElement.lang = l;
  $('btn-menu').textContent = t(l, 'menu');
  $('btn-undo').textContent = t(l, 'undo');
  $('btn-place').textContent = t(l, 'place');
  $('btn-restart').textContent = t(l, 'restart');
  $('btn-settings').textContent = t(l, 'settings');
  $('menu-title').textContent = t(l, 'levels');
  $('menu-close').textContent = t(l, 'close');
  $('settings-title').textContent = t(l, 'settings');
  $('settings-close').textContent = t(l, 'close');
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
    h.textContent = hats(p?.hats ?? 0);
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
  label.textContent = t(lang(), labelKey);
  const seg = document.createElement('div');
  seg.className = 'seg';
  for (const [value, key] of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t(lang(), key);
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
  label.textContent = t(lang(), 'sound');
  const range = document.createElement('input');
  range.type = 'range';
  range.min = '0';
  range.max = '100';
  range.value = String(Math.round(s.soundVolume * 100));
  range.setAttribute('aria-label', t(lang(), 'sound'));
  range.addEventListener('input', () => {
    const v = Number(range.value) / 100;
    setVolume(v);
    session.updateSettings({ soundVolume: v });
  });
  row.append(label, range);
  body.appendChild(row);
}

function scheduleResult(): void {
  window.clearTimeout(resultTimer);
  const state = session.state;
  if (state.status === 'playing') return;
  const factor =
    session.settings.animation === 'off' ? 0 : session.settings.animation === 'fast' ? 0.5 : 1;
  resultTimer = window.setTimeout(showResult, 500 + 700 * factor);
}

function showResult(): void {
  const l = lang();
  const state = session.state;
  if (state.status === 'playing') return;
  $('result-title').textContent =
    state.status === 'won'
      ? t(l, 'complete')
      : state.tray.every((p) => p === null) && state.board.some((p) => p === null)
        ? t(l, 'noPlates')
        : t(l, 'noSpace');
  const values = $('result-values');
  values.replaceChildren();
  const add = (text: string, cls?: string): void => {
    const s = document.createElement('span');
    s.textContent = text;
    if (cls) s.className = cls;
    values.appendChild(s);
  };
  if (state.status === 'won') add(hats(session.hatsFor(state.moveNumber)), 'hats-big');
  add(`${t(l, 'moves')} ${state.moveNumber}`);
  add(`${t(l, 'score')} ${state.score}`);

  const actions = $('result-actions');
  actions.replaceChildren();
  const btn = (key: string, fn: () => void, primary = false): void => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn${primary ? ' primary' : ''}`;
    b.textContent = t(l, key);
    b.addEventListener('click', () => {
      show('result', false);
      fn();
    });
    actions.appendChild(b);
  };
  if (state.status === 'won') {
    const next = session.nextLevelId();
    if (next) btn('next', () => startLevel(next), true);
    btn('replay', () => session.restart());
  } else {
    btn('undo', () => session.undo(), true);
    btn('restart', () => session.restart());
  }
  btn('menu', () => openMenu());
  show('result', true);
  (actions.firstElementChild as HTMLElement | null)?.focus();
}

function openMenu(): void {
  buildMenu();
  show('menu', true);
  ($('level-grid').firstElementChild as HTMLElement | null)?.focus();
}

function startLevel(id: string): void {
  show('result', false);
  session.startLevel(id);
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
  show('result', false);
  window.clearTimeout(resultTimer);
  if (e.kind === 'level' || e.kind === 'restart') scene.loadLevel();
  else if (e.kind === 'undo') scene.refresh();
  else if (e.kind === 'settings') updateHud(null);
});

$('btn-menu').addEventListener('click', openMenu);
$('menu-close').addEventListener('click', () => show('menu', false));
$('btn-settings').addEventListener('click', () => {
  buildSettings();
  show('settings', true);
});
$('settings-close').addEventListener('click', () => show('settings', false));
$('btn-undo').addEventListener('click', () => session.undo());
$('btn-restart').addEventListener('click', () => session.restart());
$('btn-place').addEventListener('click', () => scene.confirmPreview());
window.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    if (!$('menu').hidden) show('menu', false);
    else if (!$('settings').hidden) show('settings', false);
  }
});

applyStrings();
buildMenu();
buildSettings();
// Expose a tiny read-only hook for end-to-end tests.
(window as unknown as { __sas: unknown }).__sas = {
  state: () => session.state,
  level: () => session.level.id,
};
updateHud(null);

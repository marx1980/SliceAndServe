import type { GameSession } from './session';
import modesData from '../content/modes.json';
import { dailyLevel, dateKey, playableDays, type DailyEntry } from '../game/modes/daily';
import { endlessRules, passLevel, zenLevel, type ZenConfig } from '../game/modes/generate';
import { checkRescue, decodeRescue, encodeRescue, type RescueCheck } from '../game/modes/rescue';
import type { LevelDefinition, ModeId } from '../game/model/types';
import { saveProgress } from '../save/storage';
import { t } from '../ui/strings';

interface ModesContent {
  daily: DailyEntry[];
  recipes: LevelDefinition[];
  rescue: LevelDefinition[];
}
export const MODES = modesData as unknown as ModesContent;

const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...kids: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

export function todayKey(): string {
  const q = typeof location === 'undefined' ? null : new URLSearchParams(location.search);
  const forced = q?.get('today');
  return forced && /^\d{4}-\d{2}-\d{2}$/.test(forced) ? forced : dateKey(new Date());
}

/** Rescue boards shipped with the game plus the ones this player imported or converted. */
export function allRescues(session: GameSession): LevelDefinition[] {
  const own = session.progress.modes.rescues.flatMap((r) => {
    const level = decodeRescue(r.code, r.id);
    return level ? [level] : [];
  });
  return [...MODES.rescue, ...own];
}

export function addRescue(session: GameSession, level: LevelDefinition): string {
  const code = encodeRescue(level);
  const rescues = session.progress.modes.rescues.filter((r) => r.id !== level.id);
  rescues.push({ id: level.id, code });
  session.progress = {
    ...session.progress,
    modes: { ...session.progress.modes, rescues: rescues.slice(-20) },
  };
  saveProgress(session.progress);
  return code;
}

export interface ModeHandlers {
  start(level: LevelDefinition, mode: ModeId): void;
  startEndless(seed: string): void;
  close(): void;
}

let zen: ZenConfig = { goal: 'any', amount: 4, flavors: 3, seed: 'zen' };
let passTools = false;
let importText = '';
let importNote = '';

export function buildModes(
  session: GameSession,
  h: ModeHandlers,
  opts: { code?: string } = {},
): void {
  const lang = session.settings.language;
  const L = (k: string): string => t(lang, k);
  const body = $('modes-body');
  body.replaceChildren();
  $('modes-title').textContent = L('modes');
  if (opts.code) importText = opts.code;
  const res = session.progress.modes.results;
  const mark = (id: string): string => (res[id]?.completed ? ' ✓' : '');
  const group = (title: string): HTMLElement => {
    const g = el('section', { className: 'mode-group' }, el('h3', {}, title));
    body.appendChild(g);
    return g;
  };
  const seedInput = el('input', {
    type: 'text',
    id: 'mode-seed',
    value: session.progress.modes.endless.lastSeed,
    maxLength: 20,
  });
  seedInput.setAttribute('aria-label', L('seed'));
  const seed = (): string => seedInput.value.trim() || 'sunny';

  // Daily Bake
  const daily = group(L('daily'));
  const days = el('div', { className: 'chips' });
  const today = todayKey();
  for (const key of playableDays(today)) {
    const level = dailyLevel(MODES.daily, key);
    if (!level) continue;
    const r = res[level.id];
    const b = el(
      'button',
      { type: 'button', className: 'btn' },
      `${key === today ? L('today') : key.slice(5)}${mark(level.id)}`,
    );
    b.dataset.day = key;
    b.addEventListener('click', () => h.start(level, 'daily'));
    days.appendChild(b);
    if (r?.completed) b.title = `${r.bestMoves} · ${r.bestChain} · ${r.lowPeak}`;
  }
  daily.appendChild(days);

  // Seed shared by Endless, Zen and Pass-the-Cake
  const seeds = group(L('seed'));
  seeds.appendChild(seedInput);

  // Endless Service
  const e = session.progress.modes.endless;
  const endless = group(L('endless'));
  endless.appendChild(
    el('div', {}, `${L('best')}: ${L('stage')} ${e.bestStage} · ${L('score')} ${e.bestScore}`),
  );
  const rules = endlessRules(1);
  endless.appendChild(
    el(
      'div',
      {},
      `${L('unverified')} · ${L('flavourCount')} ${rules.flavors}+ · ${L('cakes')} ${rules.cakes}+`,
    ),
  );
  const startEndless = el(
    'button',
    { type: 'button', className: 'btn primary', id: 'start-endless' },
    L('start'),
  );
  startEndless.addEventListener('click', () => h.startEndless(seed()));
  endless.appendChild(startEndless);

  // Zen Kitchen
  const zg = group(L('zen'));
  const seg = <T extends string | number>(
    label: string,
    opts2: Array<[T, string]>,
    cur: T,
    set: (v: T) => void,
  ): void => {
    const row = el('div', { className: 'chips' }, el('span', {}, label));
    for (const [v, text] of opts2) {
      const b = el(
        'button',
        { type: 'button', className: `btn${v === cur ? ' primary' : ''}` },
        text,
      );
      b.setAttribute('aria-pressed', String(v === cur));
      b.addEventListener('click', () => {
        set(v);
        buildModes(session, h);
      });
      row.appendChild(b);
    }
    zg.appendChild(row);
  };
  seg<ZenConfig['goal']>(
    L('goal'),
    [
      ['any', L('cakes')],
      ['distinct', L('distinct')],
      ['flavor', L('flavourGoal')],
    ],
    zen.goal,
    (v) => (zen = { ...zen, goal: v }),
  );
  seg<ZenConfig['amount']>(
    L('amount'),
    [
      [2, '2'],
      [4, '4'],
      [6, '6'],
    ],
    zen.amount,
    (v) => (zen = { ...zen, amount: v }),
  );
  seg<ZenConfig['flavors']>(
    L('flavourCount'),
    [
      [3, '3'],
      [4, '4'],
      [5, '5'],
    ],
    zen.flavors,
    (v) => (zen = { ...zen, flavors: v }),
  );
  const startZen = el(
    'button',
    { type: 'button', className: 'btn primary', id: 'start-zen' },
    L('start'),
  );
  startZen.addEventListener('click', () => h.start(zenLevel({ ...zen, seed: seed() }), 'zen'));
  zg.appendChild(startZen);

  // Recipe Challenges
  const rg = group(L('recipe'));
  const rc = el('div', { className: 'chips' });
  for (const level of MODES.recipes) {
    const b = el('button', { type: 'button', className: 'btn' }, `${level.title}${mark(level.id)}`);
    b.dataset.puzzle = level.id;
    b.addEventListener('click', () => h.start(level, 'recipe'));
    rc.appendChild(b);
  }
  rg.appendChild(rc);

  // Rescue Kitchen
  const sg = group(L('rescue'));
  const rr = el('div', { className: 'chips' });
  for (const level of allRescues(session)) {
    const b = el('button', { type: 'button', className: 'btn' }, `${level.title}${mark(level.id)}`);
    b.dataset.puzzle = level.id;
    b.addEventListener('click', () => h.start(level, 'rescue'));
    rr.appendChild(b);
  }
  sg.appendChild(rr);
  const codeBox = el('textarea', { id: 'rescue-code', rows: 3, value: importText });
  codeBox.setAttribute('aria-label', L('code'));
  codeBox.addEventListener('input', () => (importText = codeBox.value));
  const note = el('div', { id: 'rescue-note' }, importNote);
  const imp = el('button', { type: 'button', className: 'btn', id: 'rescue-import' }, L('import'));
  imp.addEventListener('click', () => {
    const level = decodeRescue(codeBox.value, `X${session.progress.modes.rescues.length + 1}`);
    if (!level) {
      importNote = L('invalid');
      note.textContent = importNote;
      return;
    }
    const check: RescueCheck = checkRescue(level, session.settings.trayMode);
    importNote = L(
      check === 'solvable' ? 'solvable' : check === 'unsolvable' ? 'unsolvable' : 'unknownRoute',
    );
    addRescue(session, level);
    importText = '';
    buildModes(session, h);
    $('rescue-note').textContent = importNote;
  });
  const copy = el('button', { type: 'button', className: 'btn' }, L('copy'));
  copy.addEventListener('click', () => void navigator.clipboard?.writeText(codeBox.value));
  sg.append(codeBox, note, el('div', { className: 'chips' }, imp, copy));

  // Pass-the-Cake
  const pg = group(L('pass'));
  const toolsBtn = el(
    'button',
    { type: 'button', className: 'btn', id: 'pass-tools' },
    `${L('tools')}: ${passTools ? L('on') : L('off')}`,
  );
  toolsBtn.addEventListener('click', () => {
    passTools = !passTools;
    buildModes(session, h);
  });
  const startPass = el(
    'button',
    { type: 'button', className: 'btn primary', id: 'start-pass' },
    L('start'),
  );
  startPass.addEventListener('click', () => h.start(passLevel(seed(), passTools), 'pass'));
  pg.append(toolsBtn, startPass);
}

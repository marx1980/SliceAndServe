import type { GameSession } from './session';
import { BAKERY_AREAS, isRestored } from '../content/bakery';
import { FAMILY_NAMES, RECIPES, type RecipeFamily } from '../content/recipes';
import { SPEAKER_NAMES, type DialogueLine } from '../content/dialogue';
import { LEVELS } from '../content/levels';
import { completedCount, totalHats } from '../save/storage';
import { t } from '../ui/strings';
import type { MasteryGoal } from '../game/model/types';

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

export function goalLabel(lang: 'en' | 'hr', goal: MasteryGoal): string {
  const L = (k: string): string => t(lang, k);
  switch (goal.kind) {
    case 'chain':
      return `${L('goalChain')} ${goal.depth}`;
    case 'score':
      return `${L('goalScore')} ${goal.points}`;
    case 'tidy':
      return `${L('goalTidy')} ${goal.minEmpty}`;
    case 'no-tools':
      return L('goalNoTools');
  }
}

/** Recipe book: one stamp per level, grouped by family. Locked stamps show only a mark. */
export function buildRecipes(session: GameSession): void {
  const lang = session.settings.language;
  const body = $('recipes-body');
  body.replaceChildren();
  const done = (levelId: string): boolean => session.progress.levels[levelId]?.completed === true;
  const got = RECIPES.filter((r) => done(r.levelId)).length;
  $('recipes-title').textContent = `${t(lang, 'recipes')} ${got}/${RECIPES.length}`;
  const families = Object.keys(FAMILY_NAMES) as RecipeFamily[];
  for (const family of families) {
    const list = RECIPES.filter((r) => r.family === family);
    const have = list.filter((r) => done(r.levelId)).length;
    const group = el('section', { className: 'recipe-group' });
    group.appendChild(el('h3', {}, `${FAMILY_NAMES[family][lang]} ${have}/${list.length}`));
    const chips = el('div', { className: 'chips' });
    for (const r of list) {
      const ok = done(r.levelId);
      chips.appendChild(
        el(
          'span',
          { className: `stamp${ok ? ' got' : ''}` },
          ok ? `${r.name[lang]}` : `${r.levelId.replace('L', '')} ?`,
        ),
      );
    }
    group.appendChild(chips);
    body.appendChild(group);
  }
}

/** Bakery: seven areas that restore as levels are completed; each restored area has two styles. */
export function buildBakery(session: GameSession, onChange: () => void): void {
  const lang = session.settings.language;
  const body = $('bakery-body');
  body.replaceChildren();
  const completed = completedCount(session.progress);
  $('bakery-title').textContent = `${t(lang, 'bakery')} ${completed}/${LEVELS.length}`;
  for (const area of BAKERY_AREAS) {
    const restored = isRestored(area, completed);
    const card = el('div', { className: `area${restored ? ' restored' : ''}` });
    card.appendChild(el('span', { className: 'glyph' }, restored ? area.glyph : '🔒'));
    card.appendChild(el('span', { className: 'name' }, area.name[lang]));
    if (restored) {
      const style = session.progress.bakeryStyles[area.id] ?? 'a';
      const seg = el('div', { className: 'seg' });
      for (const key of ['a', 'b'] as const) {
        const b = el('button', { type: 'button' }, area.styles[key][lang]);
        b.setAttribute('aria-pressed', String(style === key));
        b.addEventListener('click', () => {
          session.setBakeryStyle(area.id, key);
          buildBakery(session, onChange);
          onChange();
        });
        seg.appendChild(b);
      }
      card.appendChild(seg);
    } else {
      card.appendChild(el('span', { className: 'need' }, `${completed}/${area.restoredAt}`));
    }
    body.appendChild(card);
  }
}

/** Shows story lines one at a time. Skip dismisses the rest of this set. */
export function showStory(
  session: GameSession,
  lines: readonly DialogueLine[],
  done: () => void,
): void {
  if (lines.length === 0) {
    done();
    return;
  }
  const lang = session.settings.language;
  let i = 0;
  const overlay = $('story');
  const finish = (): void => {
    overlay.hidden = true;
    session.markDialogueSeen(lines);
    done();
  };
  const render = (): void => {
    const line = lines[i] as DialogueLine;
    $('story-speaker').textContent = SPEAKER_NAMES[line.speaker];
    $('story-text').textContent = line.text[lang];
    $('story-next').textContent = i === lines.length - 1 ? t(lang, 'close') : t(lang, 'continue');
    $('story-skip').textContent = t(lang, 'skip');
    $('story-skip').hidden = lines.length === 1;
  };
  $('story-next').onclick = () => {
    i++;
    if (i >= lines.length) finish();
    else render();
  };
  $('story-skip').onclick = finish;
  render();
  overlay.hidden = false;
  $('story-next').focus();
}

export function showEnding(session: GameSession): void {
  const lang = session.settings.language;
  $('ending-title').textContent = t(lang, 'townFestival');
  const rows = $('ending-rows');
  rows.replaceChildren();
  const add = (k: string, v: string): void => {
    rows.append(el('dt', {}, t(lang, k)), el('dd', {}, v));
  };
  const done = completedCount(session.progress);
  add('completed', `${done}/${LEVELS.length}`);
  add(
    'recipes',
    `${RECIPES.filter((r) => session.progress.levels[r.levelId]?.completed).length}/${RECIPES.length}`,
  );
  add('hats', `${totalHats(session.progress)}/${LEVELS.length * 3}`);
  $('ending-credits').textContent =
    `${t(lang, 'credits')}: ${Object.values(SPEAKER_NAMES).join(', ')}`;
  $('ending-close').textContent = t(lang, 'close');
  $('ending-close').onclick = () => {
    $('ending').hidden = true;
  };
  $('ending').hidden = false;
  $('ending-close').focus();
}

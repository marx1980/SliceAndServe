import type { GameSession } from './session';
import type { ToolId } from '../game/model/types';
import { ENERGY_PER_TOOL } from '../game/rules/engine';
import { isToolLegal } from '../game/rules/tools';
import { t } from '../ui/strings';
import { FLAVORS } from '../content/flavors';

interface SceneApi {
  beginPick(fn: (hit: { cell: number; slot: number }) => void): void;
  endPick(): void;
  markPicked(cell: number | null): void;
}

const NAME_KEY: Record<ToolId, string> = {
  server: 'cakeServer',
  mitt: 'ovenMitt',
  spoon: 'tastingSpoon',
  bin: 'binTool',
};

/** Earned-tool bar: energy, choice of a newly earned tool, and the guided tool actions. */
export function createToolsUi(session: GameSession, scene: SceneApi, root: HTMLElement) {
  let active: ToolId | null = null;
  let step = 0;
  let from = -1;
  let flavor = -1;

  const L = (k: string): string => t(session.settings.language, k);
  const flavorLabel = (index: number): string => {
    const id = session.level.flavors[index] ?? '';
    return FLAVORS[id]?.name[session.settings.language] ?? id;
  };

  const btn = (
    label: string,
    fn: () => void,
    cls = 'btn',
    pressed?: boolean,
  ): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed));
    b.addEventListener('click', fn);
    return b;
  };

  const reset = (): void => {
    active = null;
    step = 0;
    from = -1;
    flavor = -1;
    scene.endPick();
  };

  const finish = (): void => {
    reset();
    render();
  };

  function begin(tool: ToolId): void {
    const state = session.state;
    if (state.status !== 'playing' || session.availableTools().tools[tool] <= 0) return;
    reset();
    if (tool === 'spoon') {
      if (isToolLegal(state, { tool: 'spoon' }) && session.permits({ tool: 'spoon' }))
        session.useTool({ tool: 'spoon' });
      return;
    }
    active = tool;
    step = 1;
    scene.beginPick(onPick);
    render();
  }

  function onPick(hit: { cell: number; slot: number }): void {
    const state = session.state;
    if (active === 'bin') {
      if (
        hit.slot >= 0 &&
        isToolLegal(state, { tool: 'bin', slot: hit.slot }) &&
        session.permits({ tool: 'bin', slot: hit.slot })
      ) {
        session.useTool({ tool: 'bin', slot: hit.slot });
        finish();
      }
      return;
    }
    if (hit.cell < 0) return;
    if (active === 'mitt') {
      if (step === 1 && state.board[hit.cell]) {
        from = hit.cell;
        step = 2;
        scene.markPicked(from);
        render();
      } else if (step === 2 && isToolLegal(state, { tool: 'mitt', from, to: hit.cell })) {
        session.useTool({ tool: 'mitt', from, to: hit.cell });
        finish();
      }
      return;
    }
    if (active === 'server') {
      if (step === 1 && state.board[hit.cell]) {
        from = hit.cell;
        step = 2;
        scene.markPicked(from);
        render();
      } else if (step === 3 && isToolLegal(state, { tool: 'server', from, to: hit.cell, flavor })) {
        session.useTool({ tool: 'server', from, to: hit.cell, flavor });
        finish();
      }
    }
  }

  function render(): void {
    const state = session.state;
    const allowed = state.allowedTools;
    root.hidden = allowed.length === 0;
    root.replaceChildren();
    if (allowed.length === 0) return;

    const row = document.createElement('div');
    row.className = 'tools-row';
    const energy = document.createElement('span');
    energy.className = 'tools-energy';
    energy.textContent = `${L('energy')} ${state.energy}/${ENERGY_PER_TOOL}`;
    row.appendChild(energy);
    const pool = session.availableTools();

    if (pool.grants > 0 && state.status === 'playing') {
      const choose = document.createElement('div');
      choose.className = 'chips';
      choose.append(
        Object.assign(document.createElement('span'), {
          textContent: `${L('choose')} ${pool.grants}`,
        }),
      );
      for (const tool of allowed) {
        choose.appendChild(
          btn(L(NAME_KEY[tool]), () => {
            if (session.permits({ tool: 'grant', choose: tool }))
              session.useTool({ tool: 'grant', choose: tool });
          }),
        );
      }
      root.append(row, choose);
    } else {
      root.appendChild(row);
    }

    const owned = document.createElement('div');
    owned.className = 'chips';
    for (const tool of allowed) {
      const count = pool.tools[tool];
      if (count <= 0 && active !== tool) continue;
      owned.appendChild(
        btn(
          `${L(NAME_KEY[tool])} ×${count}`,
          () => (active === tool ? finish() : begin(tool)),
          'btn',
          active === tool,
        ),
      );
    }
    if (owned.childElementCount > 0) root.appendChild(owned);

    if (active) {
      const prompt = document.createElement('div');
      prompt.className = 'chips';
      const stepLabel =
        active === 'bin'
          ? L('pickSlot')
          : step === 1
            ? L('pickFrom')
            : step === 2 && active === 'server'
              ? L('pickFlavor')
              : L('pickTo');
      prompt.appendChild(Object.assign(document.createElement('span'), { textContent: stepLabel }));
      if (active === 'server' && step === 2) {
        const plate = state.board[from];
        const kinds = [...new Set(plate?.slices ?? [])];
        for (const f of kinds) {
          prompt.appendChild(
            btn(flavorLabel(f), () => {
              flavor = f;
              step = 3;
              render();
            }),
          );
        }
      }
      prompt.appendChild(btn(L('cancel'), finish));
      root.appendChild(prompt);
    }

    if (state.revealed > state.queueIndex) {
      const peek = document.createElement('div');
      peek.className = 'chips';
      peek.appendChild(
        Object.assign(document.createElement('span'), { textContent: L('nextPlates') }),
      );
      for (let i = state.queueIndex; i < state.revealed; i++) {
        const p = state.queue[i];
        if (!p) continue;
        const counts = new Map<number, number>();
        for (const s of p.slices) counts.set(s, (counts.get(s) ?? 0) + 1);
        const text = [...counts].map(([f, n]) => `${flavorLabel(f)} ${n}`).join(', ');
        peek.appendChild(
          Object.assign(document.createElement('span'), { className: 'peek', textContent: text }),
        );
      }
      root.appendChild(peek);
    }
  }

  return { render, cancel: finish };
}

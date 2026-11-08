import { describe, expect, it } from 'vitest';
import { LESSONS, type TutorialStep } from '../../content/tutorials';
import { evaluateMoves } from '../../game/analysis/hints';
import { createInitialState } from '../../game/generation/expand';
import type { GameState, TrayMode } from '../../game/model/types';
import { applyAny } from '../../game/rules/apply';

const modes: TrayMode[] = ['slot', 'batch'];

describe('tutorial lessons run on the real rules', () => {
  for (const lesson of LESSONS) {
    for (const mode of modes) {
      it(`${lesson.id}: the scripted steps win in ${mode} mode`, () => {
        let state: GameState = {
          ...createInitialState(lesson.level, { trayMode: mode }),
          grants: lesson.grants ?? 0,
        };
        expect(state.status).toBe('playing');
        let maxChain = 0;
        // Undo steps restore the position from before the last play step.
        const trail: GameState[] = [];
        for (const step of lesson.steps) {
          if (step.kind === 'hint') continue;
          if (step.kind === 'undo') {
            state = trail.pop() as GameState;
            continue;
          }
          trail.push(state);
          const r = applyAny(state, step.cmd);
          maxChain = Math.max(maxChain, r.analysis.chainDepth);
          state = r.nextState;
        }
        expect(state.status).toBe('won');
        if (lesson.id === 'chain') expect(maxChain).toBe(2);
      });
    }
  }

  it('the hint lesson has exactly one winning move, the scripted one', () => {
    const lesson = LESSONS.find((l) => l.id === 'hint')!;
    const state = createInitialState(lesson.level);
    const evals = evaluateMoves(state);
    const winners = evals.filter((e) => e.verdict === 'win');
    expect(winners).toHaveLength(1);
    const step = lesson.steps.find((s) => s.kind === 'play')!;
    expect(winners[0]!.cmd).toEqual((step as Extract<TutorialStep, { kind: 'play' }>).cmd);
  });

  it('the undo lesson first move is harmless but does not win', () => {
    const lesson = LESSONS.find((l) => l.id === 'undo')!;
    const first = lesson.steps[0] as Extract<TutorialStep, { kind: 'play' }>;
    const state = createInitialState(lesson.level);
    const r = applyAny(state, first.cmd);
    expect(r.nextState.status).toBe('playing');
    expect(r.analysis.cakesCompleted).toBe(0);
  });

  it('lesson ids are unique and each has at least one play step', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const l of LESSONS) expect(l.steps.some((s) => s.kind === 'play')).toBe(true);
  });
});

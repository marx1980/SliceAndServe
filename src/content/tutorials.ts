import type { Command, LevelDefinition, OrderDefinition } from '../game/model/types';

/** What the player must do next. Anything else is ignored while a lesson runs. */
export type TutorialStep = { kind: 'play'; cmd: Command } | { kind: 'undo' } | { kind: 'hint' };

export interface Lesson {
  id: string;
  /** Strings key for the lesson name. */
  titleKey: string;
  level: LevelDefinition;
  /** Unspent tool grants at the start, for the tools lesson. */
  grants?: number;
  steps: readonly TutorialStep[];
}

const FLAVORS = ['strawberry', 'chocolate', 'lemon'];
const S = 0;
const C = 1;
const Lm = 2;

function lesson(
  id: string,
  titleKey: string,
  opts: {
    rows: number;
    columns: number;
    board: Array<[row: number, column: number, slices: number[]]>;
    tray: number[][];
    orders: OrderDefinition[];
    steps: TutorialStep[];
    tools?: LevelDefinition['allowedTools'];
    grants?: number;
  },
): Lesson {
  return {
    id,
    titleKey,
    grants: opts.grants,
    steps: opts.steps,
    level: {
      schemaVersion: 1,
      id: `T-${id}`,
      title: id,
      rows: opts.rows,
      columns: opts.columns,
      cakeSize: 6,
      flavors: FLAVORS,
      generation: {
        seed: `tutorial:${id}`,
        cakesPerFlavor: [],
        startingPlates: opts.board.length,
        minSlices: 1,
        maxSlices: 6,
        maxFlavorsPerPlate: 3,
      },
      layout: {
        cells: opts.board.map(([r, c, slices]) => ({ cell: r * opts.columns + c, slices })),
        queue: opts.tray,
      },
      orders: opts.orders,
      moveTarget: 999,
      ...(opts.tools ? { allowedTools: opts.tools } : {}),
    },
  };
}

const place = (slot: number, row: number, column: number): TutorialStep => ({
  kind: 'play',
  cmd: { slot, row, column },
});

export const LESSONS: readonly Lesson[] = [
  lesson('serve', 'lessonServe', {
    rows: 3,
    columns: 3,
    board: [[1, 1, [S, S, S]]],
    tray: [
      [S, S, S],
      [C, C],
      [Lm, Lm],
    ],
    orders: [{ kind: 'complete-any', count: 1 }],
    steps: [place(0, 1, 2)],
  }),
  lesson('orders', 'lessonOrders', {
    rows: 3,
    columns: 3,
    board: [
      [0, 0, [S, S, S]],
      [2, 2, [C, C, C]],
    ],
    tray: [
      [S, S, S],
      [C, C, C],
      [Lm, Lm],
    ],
    orders: [
      { kind: 'complete-flavor', flavor: 'strawberry', count: 1 },
      { kind: 'complete-flavor', flavor: 'chocolate', count: 1 },
    ],
    steps: [place(0, 0, 1), place(1, 2, 1)],
  }),
  lesson('chain', 'lessonChain', {
    rows: 3,
    columns: 3,
    board: [
      [0, 0, [S, S, S, C, C, C]],
      [1, 0, [C, C, C]],
    ],
    tray: [
      [S, S, S],
      [Lm, Lm],
      [Lm, Lm],
    ],
    orders: [{ kind: 'chain', depth: 2 }],
    steps: [place(0, 0, 1)],
  }),
  lesson('undo', 'lessonUndo', {
    rows: 3,
    columns: 3,
    board: [[1, 1, [S, S, S]]],
    tray: [
      [S, S, S],
      [C, C],
      [Lm, Lm],
    ],
    orders: [{ kind: 'complete-any', count: 1 }],
    steps: [place(0, 0, 0), { kind: 'undo' }, place(0, 1, 2)],
  }),
  lesson('hint', 'lessonHint', {
    rows: 1,
    columns: 2,
    board: [[0, 0, [S, S, S]]],
    tray: [
      [S, S, S],
      [C, C],
      [Lm, Lm],
    ],
    orders: [{ kind: 'complete-any', count: 1 }],
    steps: [{ kind: 'hint' }, place(0, 0, 1)],
  }),
  lesson('tools', 'lessonTools', {
    rows: 3,
    columns: 3,
    board: [[1, 1, [S, S, S]]],
    tray: [
      [S, S, S],
      [C, C],
      [Lm, Lm],
    ],
    orders: [{ kind: 'complete-any', count: 1 }],
    tools: ['bin'],
    grants: 1,
    steps: [
      { kind: 'play', cmd: { tool: 'grant', choose: 'bin' } },
      { kind: 'play', cmd: { tool: 'bin', slot: 2 } },
      place(0, 1, 2),
    ],
  }),
];

export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);

import type { LevelDefinition, MasteryGoal } from '../../game/model/types';
import campaign from './campaign.json';
import masteryData from '../mastery.json';
import targetData from '../targets.json';

/** Phase 2 vertical-slice levels. Every level is verified solvable in both tray modes (see verify-levels). */
const BASE: readonly LevelDefinition[] = [
  {
    schemaVersion: 1,
    id: 'L01',
    title: 'First Slice',
    rows: 4,
    columns: 4,
    cakeSize: 6,
    flavors: ['strawberry', 'chocolate', 'lemon'],
    generation: {
      seed: 'L01-a',
      cakesPerFlavor: [3, 3, 3],
      startingPlates: 2,
      minSlices: 2,
      maxSlices: 3,
      maxFlavorsPerPlate: 2,
    },
    orders: [{ kind: 'complete-any', count: 2 }],
    moveTarget: 7,
  },
  {
    schemaVersion: 1,
    id: 'L02',
    title: 'Pair Up',
    rows: 4,
    columns: 5,
    cakeSize: 6,
    flavors: ['strawberry', 'chocolate', 'lemon'],
    generation: {
      seed: 'L02-b',
      cakesPerFlavor: [4, 3, 3],
      startingPlates: 2,
      minSlices: 2,
      maxSlices: 3,
      maxFlavorsPerPlate: 2,
    },
    orders: [{ kind: 'complete-flavor', flavor: 'strawberry', count: 1 }],
    moveTarget: 18,
  },
  {
    schemaVersion: 1,
    id: 'L03',
    title: 'Sweet Couple',
    rows: 4,
    columns: 5,
    cakeSize: 6,
    flavors: ['strawberry', 'chocolate', 'lemon', 'pistachio'],
    generation: {
      seed: 'L03-b',
      cakesPerFlavor: [3, 3, 3, 3],
      startingPlates: 3,
      minSlices: 2,
      maxSlices: 4,
      maxFlavorsPerPlate: 3,
    },
    orders: [{ kind: 'complete-distinct', count: 2 }],
    moveTarget: 15,
  },
  {
    schemaVersion: 1,
    id: 'L04',
    title: 'Birthday Party',
    rows: 4,
    columns: 4,
    cakeSize: 6,
    flavors: ['strawberry', 'chocolate', 'lemon', 'pistachio'],
    generation: {
      seed: 'L04-b',
      cakesPerFlavor: [3, 3, 3, 3],
      startingPlates: 4,
      minSlices: 2,
      maxSlices: 4,
      maxFlavorsPerPlate: 3,
    },
    orders: [{ kind: 'complete-any', count: 6 }],
    moveTarget: 23,
  },
  {
    schemaVersion: 1,
    id: 'L05',
    title: 'Festival',
    rows: 4,
    columns: 4,
    cakeSize: 6,
    flavors: ['strawberry', 'chocolate', 'lemon', 'pistachio', 'blueberry'],
    generation: {
      seed: 'L05-a',
      cakesPerFlavor: [2, 2, 2, 2, 2],
      startingPlates: 5,
      minSlices: 2,
      maxSlices: 4,
      maxFlavorsPerPlate: 3,
    },
    orders: [{ kind: 'complete-distinct', count: 4 }],
    moveTarget: 17,
  },
];

const mastery = masteryData as Record<string, { goal: MasteryGoal }>;

/** Slice levels L01-L05 are hand authored; L06-L30 come from the tuned campaign data. */
export const LEVELS: readonly LevelDefinition[] = [...BASE, ...(campaign as LevelDefinition[])].map(
  (l) => ({
    ...l,
    moveTarget: (targetData as Record<string, number>)[l.id] ?? l.moveTarget,
    ...(mastery[l.id] ? { mastery: mastery[l.id]?.goal } : {}),
  }),
);

export function levelById(id: string): LevelDefinition | undefined {
  return LEVELS.find((l) => l.id === id);
}

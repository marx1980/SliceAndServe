/** Flavour identifier used in authored content, e.g. "strawberry". */
export type FlavorId = string;

/** Slices are stored as flavour indices (position in the level's flavour list), sorted ascending. */
export interface Plate {
  readonly id: string;
  readonly slices: readonly number[];
}

export type TrayMode = 'slot' | 'batch';

export interface Ruleset {
  readonly cakeSize: number;
  readonly trayMode: TrayMode;
  readonly traySize: number;
  readonly diagonal: boolean;
}

export type OrderDefinition =
  | { readonly kind: 'complete-flavor'; readonly flavor: FlavorId; readonly count: number }
  | { readonly kind: 'complete-any'; readonly count: number }
  | { readonly kind: 'complete-distinct'; readonly count: number }
  | { readonly kind: 'chain'; readonly depth: number };

/** Order with flavour ids resolved to indices. */
export type OrderSpec =
  | { readonly kind: 'complete-flavor'; readonly flavor: number; readonly count: number }
  | { readonly kind: 'complete-any'; readonly count: number }
  | { readonly kind: 'complete-distinct'; readonly count: number }
  | { readonly kind: 'chain'; readonly depth: number };

export interface OrderProgress {
  readonly value: number;
  readonly target: number;
  readonly complete: boolean;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  readonly schemaVersion: 1;
  readonly levelId: string;
  readonly rows: number;
  readonly columns: number;
  /** Row-major, length rows*columns. */
  readonly playable: readonly boolean[];
  /** Row-major, length rows*columns. */
  readonly board: readonly (Plate | null)[];
  readonly tray: readonly (Plate | null)[];
  /** Fixed for the whole level. */
  readonly queue: readonly Plate[];
  readonly queueIndex: number;
  readonly ruleset: Ruleset;
  readonly flavorCount: number;
  readonly orders: readonly OrderSpec[];
  readonly orderProgress: readonly OrderProgress[];
  readonly completedCakes: readonly number[];
  readonly score: number;
  readonly moveNumber: number;
  readonly status: GameStatus;
}

export interface PlacePlateCommand {
  readonly slot: number;
  readonly row: number;
  readonly column: number;
}

export type GameEvent =
  | { type: 'placed'; plateId: string; cell: number; slot: number }
  | {
      type: 'transfer';
      wave: number;
      flavor: number;
      count: number;
      fromPlateId: string;
      toPlateId: string;
      fromCell: number;
      toCell: number;
    }
  | { type: 'plate-cleared'; wave: number; plateId: string; cell: number }
  | {
      type: 'cake-complete';
      wave: number;
      depth: number;
      plateId: string;
      flavor: number;
      cell: number;
    }
  | { type: 'chain'; depth: number }
  | { type: 'tray-refill'; slots: number[] }
  | { type: 'order-progress'; index: number; progress: OrderProgress }
  | { type: 'status'; status: GameStatus };

export interface MoveAnalysis {
  readonly cakesCompleted: number;
  readonly chainDepth: number;
  readonly transfers: number;
  /** Cells emptied by clearing or completion during this move (the placed cell is not counted). */
  readonly spacesFreed: number;
  readonly emptyCellsAfter: number;
  /** Cells that took part in a transfer or completion, for previews. */
  readonly interactingCells: readonly number[];
  readonly ordersCompleted: number;
}

export interface EngineResult {
  readonly previousState: GameState;
  readonly nextState: GameState;
  readonly events: GameEvent[];
  readonly analysis: MoveAnalysis;
}

export interface LevelGeneration {
  readonly seed: string;
  /** Cakes to produce per flavour, same order as `flavors`. */
  readonly cakesPerFlavor: readonly number[];
  readonly startingPlates: number;
  readonly minSlices: number;
  readonly maxSlices: number;
  readonly maxFlavorsPerPlate: number;
}

export interface LevelDefinition {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly title: string;
  readonly rows: number;
  readonly columns: number;
  /** Optional mask, one string per row, '#' playable and '.' blocked. */
  readonly mask?: readonly string[];
  readonly cakeSize: number;
  readonly flavors: readonly FlavorId[];
  readonly generation: LevelGeneration;
  readonly orders: readonly OrderDefinition[];
  /** Suggested move count for the second chef hat. */
  readonly moveTarget: number;
}

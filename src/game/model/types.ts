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

export type ToolId = 'server' | 'mitt' | 'spoon' | 'bin';
export const TOOL_IDS: readonly ToolId[] = ['server', 'mitt', 'spoon', 'bin'];
export type ToolInventory = Readonly<Record<ToolId, number>>;
export const NO_TOOLS: ToolInventory = { server: 0, mitt: 0, spoon: 0, bin: 0 };

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
  /** Tools the level allows; empty means no tools and no energy. */
  readonly allowedTools: readonly ToolId[];
  /** Sugar energy toward the next earned tool (0-5). */
  readonly energy: number;
  /** Earned tools waiting for the player's choice. */
  readonly grants: number;
  readonly tools: ToolInventory;
  /** Absolute queue index up to which the tasting spoon has revealed incoming plates. */
  readonly revealed: number;
}

export interface PlacePlateCommand {
  readonly slot: number;
  readonly row: number;
  readonly column: number;
}

export type ToolCommand =
  | { readonly tool: 'grant'; readonly choose: ToolId }
  | { readonly tool: 'server'; readonly from: number; readonly to: number; readonly flavor: number }
  | { readonly tool: 'mitt'; readonly from: number; readonly to: number }
  | { readonly tool: 'spoon' }
  | { readonly tool: 'bin'; readonly slot: number };

/** Any player action recorded in the timeline. */
export type Command = PlacePlateCommand | ToolCommand;

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
  | { type: 'tool'; tool: ToolId | 'grant'; detail?: number }
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

/** Explicit starting position, used by Rescue and Recipe Challenge puzzles instead of generation. */
export interface FixedLayout {
  /** Starting plates: board cell index and slices (flavour indices). */
  readonly cells: readonly { readonly cell: number; readonly slices: readonly number[] }[];
  /** Tray content first (up to three), then the queue, in order. */
  readonly queue: readonly (readonly number[])[];
}

export type ModeId = 'campaign' | 'daily' | 'endless' | 'zen' | 'rescue' | 'recipe' | 'pass';

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
  /** When present the layout is used as given and `generation` only carries the seed. */
  readonly layout?: FixedLayout;
  readonly orders: readonly OrderDefinition[];
  /** Suggested move count for the second chef hat. */
  readonly moveTarget: number;
  /** Earned chef tools usable on this level; never required to win. */
  readonly allowedTools?: readonly ToolId[];
  /** Optional third-hat goal. */
  readonly mastery?: MasteryGoal;
}

/** Level-specific mastery goal for the third chef hat. */
export type MasteryGoal =
  | { readonly kind: 'chain'; readonly depth: number }
  | { readonly kind: 'score'; readonly points: number }
  | { readonly kind: 'tidy'; readonly minEmpty: number }
  | { readonly kind: 'no-tools' };

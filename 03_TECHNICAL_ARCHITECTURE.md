# 03: Technical Architecture

## Core principle
The rules engine receives immutable state plus a command and returns a new state, an event list, and move analysis. Phaser renders the returned events. Rendering never determines results.

```ts
interface PlacePlateCommand {
  incomingChoiceId: string;
  row: number;
  column: number;
}

interface EngineResult {
  previousState: GameState;
  nextState: GameState;
  events: GameEvent[];
  analysis: MoveAnalysis;
}
```

## Suggested models
```ts
type FlavorId = string;
type PlateId = string;
type LevelId = string;

interface Slice {
  id: string;
  flavorId: FlavorId;
  kind: "normal" | "wild" | "double" | "mystery" | "burnt" | "rainbow" | "fresh" | "golden";
  hiddenFlavorId?: FlavorId;
  remainingFreshMoves?: number;
}

interface Plate {
  id: PlateId;
  capacity: number;
  plateKind: "standard" | "lazy-susan" | "one-way" | "locked" | "cooling-rack" | "golden" | "cracked";
  slices: Slice[];
  locked?: boolean;
  orientation?: number;
}

interface BoardCell {
  row: number;
  column: number;
  playable: boolean;
  plate: Plate | null;
}

interface IncomingChoice {
  id: string;
  plate: Plate;
}

interface LevelDefinition {
  schemaVersion: number;
  id: LevelId;
  title: string;
  rows: number;
  columns: number;
  playableMask?: boolean[][];
  cakeSize: number;
  allowedFlavors: FlavorId[];
  startingBoard: BoardCell[][];
  incomingSequence?: IncomingChoice[][];
  seed?: string;
  orders: OrderDefinition[];
  masteryGoals: MasteryDefinition[];
  allowedTools: string[];
  ruleset: Ruleset;
  verification?: VerificationRecord;
}

interface GameState {
  schemaVersion: number;
  levelId: LevelId;
  board: BoardCell[][];
  incoming: IncomingChoice[];
  incomingIndex: number;
  completedCakes: Record<FlavorId, number>;
  score: number;
  moveNumber: number;
  sugarEnergy: number;
  orderProgress: OrderProgress[];
  randomState: string;
  status: "playing" | "won" | "lost";
}
```

Use runtime schema validation for levels, saves, imports, and share codes. Version every persisted format and provide migrations.

## Seeded generation
- Never use unseeded randomness in game logic.
- Persist the generator state in saves and history.
- Same seed plus command sequence must reproduce the same final state.
- Previews must clone the state and run the real engine.

## Save and offline behaviour
Use localStorage initially with:
- Versioned schema
- Migration functions
- Corruption recovery
- Export and import
- Separate progress and settings records
- Autosave after stable state changes

Suspended puzzles preserve board, queue position, random state, order progress, full timeline, active branch, and tool state.

Prepare for PWA installation only after the core game is stable.

## Player-created puzzle format
The editor must serialize:
- Board size and cell mask
- Starting plates and slice arrangements
- Incoming sequence or seed
- Orders and mastery conditions
- Special slices and plates
- Tools and queue visibility
- Ruleset and metadata

Support compact share codes plus JSON import/export. Keep future community storage behind a repository interface so offline editor work is not blocked by a backend.

## Performance
Target a typical mid-range phone:
- Normal move resolution under 16 ms where practical
- No visible input lag
- Stable rendering
- Lazy-loaded editor and bakery content
- Object reuse in solver loops where useful
- Heavy solving in Web Workers
- Simulations must not block the UI
- Bounded particle counts and pooled Phaser objects

Instrument move resolution, render duration, solver duration, memory growth, and simulation throughput.

## Accessibility
- Minimum 44 by 44 CSS pixel targets
- Keyboard support for core play
- Visible focus
- Screen-reader labels
- Colour plus pattern identifiers
- Reduced motion
- Scalable text
- Separate sound controls
- Non-audio representation of essential cues
- No essential information only in animation
- Pause/resume
- Test 320, 375, and 768 pixel widths plus desktop landscape

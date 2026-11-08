# 05: Testing, Simulation, and Acceptance

## Headless agents
Implement pluggable agents:
- RandomAgent
- CompletionAgent
- SpaceAgent
- GreedyMergeAgent
- OrderAgent
- ComboAgent
- SafetyAgent
- CollectorAgent
- ImpatientAgent
- HumanErrorAgent, usually strong but occasionally choosing second- or third-ranked moves
- LookaheadAgent, searching two to four turns
- SolverAgent using BFS, A*, beam search, or another suitable method

```ts
interface GameAgent {
  id: string;
  chooseMove(state: GameState, context: AgentContext): LegalMove;
}
```

## Simulation CLI
Support level selection, agent selection, simulation count, seed range, safe parallelism, JSON output, CSV output, and machine-readable failures.

Use at least 5,000 runs per level during balancing and up to 10,000 for final validation.

Collect:
- Win rate by agent
- Average and median moves
- First completion turn
- Longest period without positive feedback
- Peak occupancy and occupancy by turn
- First failure turn
- Meaningful choice count
- Dominant-move frequency
- Flavour fragmentation
- Combo frequency and maximum chain
- Comeback rate after 80 percent occupancy
- Tool use and dependency
- Rewind opportunities
- Solver path length
- Verified route count
- Viable first moves
- Move-resolution time
- Total simulation time
- Seed variance

## Balancing guidance
- Levels 1 to 3: RandomAgent above 80 percent
- Levels 1 to 10: ordinary-agent range roughly 85 to 95 percent
- Levels 11 to 30: roughly 70 to 85 percent
- Standard later levels: roughly 55 to 75 percent
- Clearly marked hard levels: roughly 35 to 55 percent
- SolverAgent: 100 percent of campaign levels
- No normal campaign level requires a tool
- Most wins should include a two-cake chain
- Avoid more than four moves without positive feedback
- Most turns should offer at least two meaningful choices (moves leading to different canonical states after resolution)

Treat these as balancing targets, not hard-coded rules.

## Unit tests
Cover placement, neighbours, transfer priority, ties, capacity, termination, simultaneous completion, chains, specials, orders, win/loss, rewind, branch restoration, seeded reproduction, serialization, migrations, and share-code validation.

## Property tests
Where practical verify:
- Resolution terminates.
- Slice quantity is preserved except for explicit transforms/removal.
- Capacity is never exceeded.
- Same seed and commands give identical results.
- Rewind restores the exact state.
- Replay reproduces the final state.
- Rendering cannot alter state.
- Serialization preserves campaign solvability.

## Playwright flows
- Start game and tutorial
- Tap placement
- Drag placement
- Preview move
- Complete cake and chain
- Undo and timeline rewind
- Branch from history
- Lose and retry from critical move
- Complete an order
- Restore bakery progress
- Save and resume
- Change difficulty
- Use reduced motion
- Create, export, and import a puzzle
- Play at 320 pixel width
- Run under a GitHub Pages subpath

## First-release definition of done
- At least 30 campaign levels
- Solver-confirmed solution for every campaign level
- No required chef tool
- Deterministic rules
- Exact preview-to-result consistency
- Exact rewind restoration
- Verified failure alternative where one exists
- Relaxed and Classic profiles
- Tray model setting (slot and batch), with every level verified in both
- Eight flavours distinguishable without colour alone
- Working orders and chains
- Persistent bakery and recipes
- 320-pixel usability
- Keyboard and reduced-motion support
- Passing unit and Playwright tests
- Successful production build
- Working GitHub Pages deployment under repository subpath
- JSON and CSV simulation outputs
- Documented setup, architecture, controls, and deployment
- No payment, advertising, or analytics dependencies in the initial build

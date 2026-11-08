# Slice & Serve: Agent Instructions

## Mission
Build a polished, mobile-first browser puzzle game called **Slice & Serve**. Players place plates containing cake or pie slices on a board. Matching slices consolidate between adjacent plates. Six matching slices form a completed cake, which is served and removed.

The game must be strategically satisfying, transparent, accessible, solver-verified, and respectful of the player's time. Its promise is:

> A delicious sorting puzzle that challenges your decisions, not your patience or wallet.

Do not add paid lives, paid undo, consumable hints, forced advertising, manipulated difficulty, fake countdowns, punitive streaks, artificial waiting, or impossible sequences created to sell solutions.

## Required stack
- TypeScript
- Vite
- Phaser 3 for board rendering, input, and animation
- HTML/CSS for menus and overlays
- Vitest
- Playwright
- ESLint and Prettier
- Static hosting compatible with GitHub Pages
- localStorage initially, using a versioned save schema

Do not add a backend in the initial implementation.

## First actions
1. Inspect the repository, README, package scripts, workflows, and existing assets.
2. Reuse working infrastructure where sensible.
3. Do not rewrite unrelated files.
4. Record current build, test, and deployment commands.
5. Create a short implementation checklist.
6. Build a small playable vertical slice before creating final art or large amounts of content.

## Architecture rule
The game rules must be framework-independent TypeScript. Phaser only renders state and consumes game events. Animation must never calculate or alter game outcomes.

Suggested structure:

```text
src/
  app/
  game/
    model/
    rules/
    history/
    analysis/
    generation/
    simulation/
      agents/
    scenes/
    rendering/
  content/
    levels/
    dialogue/
  editor/
  ui/
  save/
  tests/
    unit/
    integration/
    e2e/
```

## Scope order
1. Deterministic core sorting
2. Predictable chain reactions
3. Customer orders
4. Full rewind and branching
5. Solver verification
6. Failure analysis and educational hints
7. Automated balancing agents
8. Bakery restoration and recipe collection
9. Puzzle editor and share codes
10. Additional modes
11. Community services only after the offline game is proven

Read the remaining files in this package before implementation:

- `01_GAME_DESIGN.md`
- `02_FAIRNESS_AND_PLAYER_RESPECT.md`
- `03_TECHNICAL_ARCHITECTURE.md`
- `04_CONTENT_PROGRESSION_AND_MODES.md`
- `05_TESTING_SIMULATION_AND_ACCEPTANCE.md`
- `06_IMPLEMENTATION_ROADMAP.md`

## Non-negotiable rules
- All campaign levels are solvable without tools or payment.
- The same state, seed, and commands always produce the same result.
- Placement previews use the real rules engine.
- Rewind is unlimited and free.
- Hints are unlimited and educational.
- Failure never removes earned progress.
- Campaign progression has a real ending.
- Difficulty comes from decisions and interacting systems, not hidden manipulation.
- At 320 CSS pixels wide, the game remains completely usable.
- Do not claim tests, simulations, builds, deployment, or verification succeeded unless they were actually run successfully.

## Work style
Use small, reviewable commits. Run type checking, linting, relevant tests, and a production build after each phase. Do not weaken tests to make them pass. When ambiguity exists, choose the simplest deterministic rule, document it, make it configurable, and add a test.

## Session report
At the end of each work session, report:
- Completed work
- Changed files
- Architectural decisions
- Commands executed
- Test and build results
- Simulation and solver results
- Manually verified flows
- Known limitations and risks
- Recommended next task
- Deployment URL only if deployment actually succeeded

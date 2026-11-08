# 06: Implementation Roadmap

## Phase 1: Pure rules prototype
Deliver state model, board, standard plates, normal slices, placement command, deterministic resolution per `00_RULES_SPEC.md`, completion, win/loss, both tray models, seeded queue generation, and exhaustive unit tests. Use placeholder colours and patterns.

## Phase 2: Playable vertical slice
Deliver Phaser board, incoming tray, tap and drag, placement preview, five levels, basic orders, undo/restart, responsive UI, basic sound, animation, settings (including the tray model toggle), and a basic solver with `verify-levels` and a minimal simulation CLI so every shipped level is verified in both tray modes.

## Phase 3: Player-respect systems
Deliver full timeline rewind, branching, progressive hints (on the solver), Teach Me mode, failure analysis, retry from critical move, and Fair Bake receipt.

## Phase 4: Automated balancing
Deliver all initial agents, stronger solver, full simulation CLI, JSON and CSV reports, verification pipeline, difficulty report, and CI solvability validation. Content is not authored at scale before this phase is done.

## Phase 5: Progression
Deliver 30 levels, recipe book, bakery restoration, concise dialogue, earned chef tools, mastery goals, and save migrations.

## Phase 6: Additional offline modes
Deliver Daily Bake framework, Endless Service, Zen Kitchen, Rescue Kitchen, Recipe Challenges, and Pass-the-Cake. Backend-dependent leaderboards are not required.

## Phase 7: Bakery Workshop
Deliver puzzle editor, validation, difficulty estimation, share-code import/export, JSON import/export, and house rules.

## Phase 8: Release polish
Deliver accessibility audit, performance optimization, PWA support, GitHub Pages deployment, Player Promise, credits, and a credible first-chapter conclusion or campaign ending.

## Commit sequence
1. Scaffold and state model
2. Resolver and tests
3. Basic board
4. Orders and chains
5. Solver and level verification
6. Timeline and rewind, hints and failure analysis
7. Agents, simulation and balancing
8. Bakery, recipes and level content
9. Additional modes
10. Workshop and share codes
11. Accessibility and performance
12. Deployment and documentation

## Validation after each phase
Run the project's actual equivalents of:

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
npm run simulate
npm run verify-levels
```

Only run scripts that exist, adding missing scripts as part of the work. Fix regressions before moving on.

## Scope controls
- Do not add a backend initially.
- Do not build social infrastructure before core fun is proven.
- Do not author hundreds of levels before the solver and simulation pipeline exists.
- Do not create final art before mechanics and interaction are validated.
- Do not introduce unseeded randomness.
- Do not make unrelated redesigns.
- Do not weaken tests.

## Final agent report template
```text
Completed:
Changed files:
Architecture decisions:
Commands executed:
Typecheck:
Lint:
Unit tests:
E2E tests:
Production build:
Level verification:
Simulation summary:
Manual verification:
Known limitations:
Remaining risks:
Recommended next task:
Deployment URL (only if successful):
```

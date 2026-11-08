# Build Plan
This is the source of truth for what should be built next.

## NEXT

### 7. Phase 3: player-respect systems
Status: NEXT
Goal:
Full timeline rewind with branching, progressive hints on the solver, failure analysis, and the Fair Bake receipt screen.

Requirements:
- Timeline scrub and branch from any earlier state (builds on `History`).
- Hint ladder with solver-confirmed vs heuristic labels.
- Failure analysis: last winning state, first losing move, verified alternative.
- Retry from critical move.

Acceptance criteria:
- Rewind restores exact states; replay reproduces the final state (tests exist for the linear case).
- Hints never lie about solvability.

---

## QUEUED

### 8. Phase 4: balancing
Status: NOT STARTED
Goal:
Full agent set, stronger solver, JSON and CSV reports, difficulty report, CI solvability check. Retune the five slice levels (see decisions) before authoring more.

### 9. Phase 5: progression
Status: NOT STARTED
Goal:
30 levels, recipe book, bakery, tools, mastery, save migrations.

---

## COMPLETED

### 1-2. Phases 1-2 (DONE)
- Docs reviewed and updated; `00_RULES_SPEC.md` added.
- Rules engine, both tray models, seeded level generation, history/undo, orders, chains.
- Basic solver, `verify-levels`, simulation CLI with random and greedy agents.
- Phaser vertical slice: five levels, tap (with preview) and drag, keyboard, settings, Croatian and English strings, sound, versioned saves.

---

## Decisions / Important Context
- Plates never move between cells, so a cleared cake cannot create new adjacency. Resolution runs in rounds that re-examine only changed plates; chain depth counts rounds that completed a cake.
- Tray model (slot or batch) is a setting applied at the next restart. Both consume the same fixed queue.
- Level supply is generated from a seed with zero leftover slices; levels carry slack by making more cakes than the order needs.
- Only the first two chef hats exist; the move targets are provisional and not solver-verified as achievable.
- Hat 3 (mastery goal), tools, hints, failure analysis and branching are not built yet.
- Slice levels are not balanced: random agent wins roughly 91%, 21%, 40%, 3%, 1% on L01 to L05 (slot mode). Retune in Phase 4.
- Playwright cannot download its browser in the cloud workspace; use `PW_CHROME`.
- Not deployed yet. GitHub Pages deployment is Phase 8.

# Build Plan
This is the source of truth for what should be built next.

## NEXT

### 8. Phase 4: balancing
Status: NEXT
Goal:
Full agent set, stronger solver, JSON and CSV reports, difficulty report, and a CI solvability check. Retune the five slice levels before authoring more.

Requirements:
- Remaining agents from `05_TESTING_SIMULATION_AND_ACCEPTANCE.md` (Completion, Space, Order, Combo, Safety, HumanError, Lookahead).
- Simulation metrics (win rate by agent, occupancy, first completion turn, comeback rate, dominant-move frequency).
- Receipt refresh and a test or CI step that fails on outdated receipts.
- Retune L01 to L05 toward the balancing targets; prove hat 2 move targets are achievable.

Acceptance criteria:
- Every level verified in both tray models with a current receipt.
- Difficulty report with agent win rates per level.

---

## QUEUED

### 9. Phase 5: progression
Status: NOT STARTED
Goal:
30 levels, recipe book, bakery, tools, mastery (hat 3), suspend and resume with the full timeline, save migrations.

---

## COMPLETED

### 1-2. Phases 1-2 (DONE)
- Docs reviewed and updated; `00_RULES_SPEC.md` added.
- Rules engine, both tray models, seeded level generation, history/undo, orders, chains.
- Basic solver, `verify-levels`, simulation CLI with random and greedy agents.
- Phaser vertical slice: five levels, tap (with preview) and drag, keyboard, settings, Croatian and English strings, sound, versioned saves.

### 3. Phase 3: player-respect systems (DONE)
- Timeline tree with branches and bookmarks, solver-backed hint ladder, Teach Me, failure analysis with retry from the closing move, Fair Bake receipts, worker-based analysis.

---

## Decisions / Important Context
- Plates never move between cells, so a cleared cake cannot create new adjacency. Resolution runs in rounds that re-examine only changed plates; chain depth counts rounds that completed a cake.
- Tray model (slot or batch) is a setting applied at the next restart. Both consume the same fixed queue.
- Level supply is generated from a seed with zero leftover slices; levels carry slack by making more cakes than the order needs.
- Only the first two chef hats exist; the move targets are provisional and not solver-verified as achievable.
- Hat 3 (mastery goal) and tools are not built yet. The timeline is not persisted across sessions yet.
- Hints and analysis use bounded solver searches; the badge says Heuristic or Best known when a search is not conclusive.
- Receipts (`src/content/receipts.json`) carry a level hash; editing a level without re-running `verify-levels -- --write` marks it outdated and fails a unit test.
- Restart keeps the timeline unless the tray setting changed.
- Slice levels are not balanced: random agent wins roughly 91%, 21%, 40%, 3%, 1% on L01 to L05 (slot mode). Retune in Phase 4.
- Playwright cannot download its browser in the cloud workspace; use `PW_CHROME`.
- Not deployed yet. GitHub Pages deployment is Phase 8.

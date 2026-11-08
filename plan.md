# Build Plan
This is the source of truth for what should be built next.

## NEXT

### 9. Phase 5: progression
Status: NEXT
Goal:
30 levels, recipe book, bakery, tools, mastery (hat 3), suspend and resume with the full timeline, save migrations. New levels must pass `npm run simulate:check` and have current receipts.

---

## QUEUED


## COMPLETED

### 1-2. Phases 1-2 (DONE)
- Docs reviewed and updated; `00_RULES_SPEC.md` added.
- Rules engine, both tray models, seeded level generation, history/undo, orders, chains.
- Basic solver, `verify-levels`, simulation CLI with random and greedy agents.
- Phaser vertical slice: five levels, tap (with preview) and drag, keyboard, settings, Croatian and English strings, sound, versioned saves.

### 3. Phase 3: player-respect systems (DONE)
- Timeline tree with branches and bookmarks, solver-backed hint ladder, Teach Me, failure analysis with retry from the closing move, Fair Bake receipts, worker-based analysis.

### 4. Phase 4: balancing (DONE)
- Twelve agents (Random, Completion, Space, GreedyMerge, Order, Combo, Safety, Collector, Impatient, HumanError, Lookahead, Solver), parallel simulation CLI (JSON/CSV), balance bands with `--check`, difficulty report in `reports/`.
- Iterative-deepening shortest-line solver; receipts store a replayable shortest line and whether it is proven minimal.
- L01-L05 retuned: random wins about 91%, 93%, 83% on L01-L03; human-error agent 95% and 89-91% on L04-L05; solver wins all in both tray models.
- CI workflow runs typecheck, lint, format, unit tests, build, simulation check and e2e.

---

## Decisions / Important Context
- Plates never move between cells, so a cleared cake cannot create new adjacency. Resolution runs in rounds that re-examine only changed plates; chain depth counts rounds that completed a cake.
- Tray model (slot or batch) is a setting applied at the next restart. Both consume the same fixed queue.
- Level supply is generated from a seed with zero leftover slices; levels carry slack by making more cakes than the order needs.
- Only the first two chef hats exist. Move targets are the larger per-mode best known line plus 3, and a test requires them to be reachable; most known lines are upper bounds (marked `?` in the report), not proven minimums.
- Hat 3 (mastery goal) and tools are not built yet. The timeline is not persisted across sessions yet.
- Hints and analysis use bounded solver searches; the badge says Heuristic or Best known when a search is not conclusive.
- Receipts (`src/content/receipts.json`) carry a level hash; editing a level without re-running `verify-levels -- --write` marks it outdated and fails a unit test.
- Restart keeps the timeline unless the tray setting changed.
- Balance bands are targets: the check fails only when the 95% interval misses the band. For L01-L03 the ordinary agent only has a floor (85%) because random above 80% implies near-certain wins for stronger agents.
- Receipt hashes ignore title and move target; changing rules, board, seed or orders marks receipts outdated.
- Playwright cannot download its browser in the cloud workspace; use `PW_CHROME`.
- Not deployed yet. GitHub Pages deployment is Phase 8.

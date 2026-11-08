# Build Plan
This is the source of truth for what should be built next.

## NEXT

### 10. Phase 6: modes
Status: NEXT
Goal:
Daily Bake framework, Endless Service, Zen Kitchen, Rescue Kitchen, Recipe Challenges, Pass-the-Cake. See `06_IMPLEMENTATION_ROADMAP.md`.

---

## QUEUED

Phase 7 (Bakery Workshop) and later: see `06_IMPLEMENTATION_ROADMAP.md`.

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

### 5. Phase 5: progression (DONE)
- 30 levels in two chapters (L01-L05 hand authored, L06-L30 tuned by `npm run tune-levels` from `scripts/level-specs.ts`), all verified in both tray models with current receipts and balanced to the bands.
- Earned chef tools (Cake server, Oven mitt, Tasting spoon, Bin) with sugar energy; tools live in the timeline and are never required.
- Third hat: per-level mastery goals with replayable witness lines; move targets (hat 2) from best known lines.
- Recipe book (30 stamps in six families), bakery with seven restorable areas and two styles each, short skippable dialogue, ending screen.
- Suspend and resume with the full timeline per level; saves are version 2 with migrations from version 1; export and import.

---

## Decisions / Important Context
- Plates never move between cells, so a cleared cake cannot create new adjacency. Resolution runs in rounds that re-examine only changed plates; chain depth counts rounds that completed a cake.
- Tray model (slot or batch) is a setting applied at the next restart. Both consume the same fixed queue.
- Level supply is generated from a seed with zero leftover slices; levels carry slack by making more cakes than the order needs.
- Only the first two chef hats exist. Move targets are the larger per-mode best known line plus 3, and a test requires them to be reachable; most known lines are upper bounds (marked `?` in the report), not proven minimums.
- Tools and energy are per level and do not carry over. Bakery restoration is cosmetic and gates nothing.
- The campaign has no chain-depth orders: the ordinary agent rarely plans chains, so chain depth appears as mastery goals instead.
- Level data: L01-L05 in `src/content/levels/index.ts`, L06-L30 in `campaign.json`; mastery in `mastery.json`; move targets in `targets.json`. After editing a level run `npm run verify-levels -- --write`, `npm run mastery` and `npm run set-targets`.
- Hints and analysis use bounded solver searches; the badge says Heuristic or Best known when a search is not conclusive.
- Receipts (`src/content/receipts.json`) carry a level hash; editing a level without re-running `verify-levels -- --write` marks it outdated and fails a unit test.
- Restart keeps the timeline unless the tray setting changed.
- Balance bands are targets: the check fails only when the 95% interval misses the band. For L01-L03 the ordinary agent only has a floor (85%) because random above 80% implies near-certain wins for stronger agents.
- Receipt hashes ignore title and move target; changing rules, board, seed or orders marks receipts outdated.
- Playwright cannot download its browser in the cloud workspace; use `PW_CHROME`.
- Not deployed yet. GitHub Pages deployment is Phase 8.

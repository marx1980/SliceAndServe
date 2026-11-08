# Build Plan
This is the source of truth for what should be built next.

## NEXT

### 11. Phase 7: Bakery Workshop
Status: NEXT
Goal:
Puzzle editor, share codes and playtesting. See `06_IMPLEMENTATION_ROADMAP.md`.

---

## QUEUED

Phase 8 and later: see `06_IMPLEMENTATION_ROADMAP.md`.

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

### 10. Phase 6: modes (DONE)
- Mode screen (Menu > Modes) with Daily Bake, Endless Service, Zen Kitchen, Rescue Kitchen, Recipe Challenges and Pass-the-Cake. Everything runs offline.
- Daily Bake: pool of 42 pre-verified puzzles (three tiers) in `src/content/modes.json`; the local date picks the entry, the last seven days stay playable; results record moves, best chain, peak plates, score.
- Endless Service: generated stages (more flavours, cakes and plates as stages rise), labelled Not solver-checked, seed and rules shown in Fair Bake.
- Zen Kitchen: selectable goal, amount and flavour count; no score, no hats; a stuck board only offers undo and restart.
- Rescue Kitchen: 10 near-full boards; a failed timeline converts to a Rescue puzzle (latest solver-confirmed position); share codes (`SSR1:`) import and export with validation and a solver check.
- Recipe Challenges: 12 fixed boards with a visible queue and specified cakes.
- Pass-the-Cake: two players alternate placements on one device; turn is derived from the timeline so undo hands the turn back; tools on or off (shared).
- Saves are version 3 (adds mode results, Endless best, imported rescues) with migrations from versions 1 and 2.

### 10b. Phase 6.1: loose ends and tutorials (DONE)
- Flaky keyboard e2e traced to a near-miss on the 30 s test timeout (the loop took ~25 s); trimmed and given room, CI retry removed.
- Failure analysis and Teach Me now handle tool moves. A tool move can restore a tool-free route, so with tools in a line the reported closing move is a boundary, not necessarily the only one.
- Shortest-line search gained an admissible lower bound (`movesLowerBound`). It proves more small levels (L01 and L03 both tray models) but not the bigger ones: a full proof run was not feasible, so most receipts still say "?".
- Pass-the-Cake has a third tools option, Separate: each earned tool belongs to the player whose move earned it (derived from the timeline; energy stays shared).
- Rescue conversion has a browser test.
- Tutorials (Menu > Tutorials): six lessons (Serve a cake, Orders, Chain, Undo, Hint, Tools) on the real rules engine. Only the scripted move is accepted, the target cell is ringed, one imperative label per step. Every lesson's script is replayed by a unit test in both tray models. A fresh profile sees the lesson list once.

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
- Mode content: `npm run build-modes` rebuilds `modes.json` (add `-- daily`, `recipes` or `rescue` for one part). Every shipped entry is solver-checked in both tray models. Daily difficulty tiers are checked against the ordinary agent's win rate.
- Mode puzzles never touch hats, the recipe book or the bakery.
- Rescue conversion keeps the remaining orders, tray and queue; in batch mode a partly used tray becomes a fresh tray, so imported boards are re-checked in the player's current tray model.
- Rush Hour and Puzzle of the Week are not part of Phase 6.
- Tutorial lessons live in `src/content/tutorials.ts` as fixed layouts; progress is stored in `modes.tutorials`. They never touch hats, the bakery or campaign progress.


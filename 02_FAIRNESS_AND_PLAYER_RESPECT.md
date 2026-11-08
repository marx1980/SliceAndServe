# 02: Fairness and Player-Respect Systems

## Full timeline rewind
Rewind is a defining system, not a consumable.

Players can:
- Undo the last move.
- Scrub to any earlier stable state.
- Restore and branch from that state.
- Bookmark positions.
- Return to a previous branch.
- Replay a completed solution.

History stores the command log plus periodic snapshots; any state is recomputed by replay, which determinism guarantees. Each entry records the move number, selection, destination, random-generator state, resolution events, completed cakes, and order progress. Rewind may affect optional mastery records, but never blocks completion or progression.

## Educational hint ladder
Hints are unlimited:
Every hint is labelled either solver-confirmed (a verified winning route exists) or heuristic.

1. Highlight three promising cells.
2. Narrow to two.
3. Show the recommended placement.
4. Explain why.
5. Preview the next two turns.
6. Demonstrate a complete valid solution.

Teach Me mode compares the player's move with an agent recommendation, projected occupancy, fragmentation risk, order progress, and chain potential. Generate explanations from real simulation data, not generic text.

## Failure analysis
After deadlock, identify:
- The last state with a winning route.
- The first move after which no solver-confirmed route remained.
- The most fragmented flavour.
- A missed completion.
- A verified alternative move.
- Whether recovery remained possible.

Offer restart, retry from the critical move, watch the alternative, free exploration, and conversion into a rescue challenge. Use neutral language and never shame the player.

## Fair Bake verification
Before campaign acceptance:
1. Load the exact initial state and sequence or seed.
2. Run the solver.
3. Verify at least one complete solution.
4. Record the shortest known solution.
5. Count viable first moves.
6. Estimate successful route diversity.
7. Test recovery after reasonable suboptimal moves.
8. Record agent win rates and tool dependency.
9. Save a verification record.

Every campaign level is verified in both tray modes. A route is a distinct sequence of the first N moves (N is recorded in the receipt) that the solver confirms reaches a win. Counts from bounded search are reported as lower bounds.

Normal campaign guidance:
- At least three viable first moves.
- At least five known winning routes (lower bound).
- At least one recovery route after an early suboptimal move.
- No required tool.
- No dynamically worsening sequence.
- No hidden sequence replacement after failure.

Single-solution levels are permitted only in a clearly labelled Knife's Edge mode.

An optional fairness view may show: level ID, seed, verification status, known route count, viable first moves, shortest known solution, fixed-sequence status, and randomness status.

## Player-controlled difficulty
### Relaxed Bakery
- Larger board or fewer constraints
- Fewer simultaneous flavours
- Full queue preview
- Deadlock warnings
- Stronger hints
- Unlimited rewind

### Classic Bakery
- Intended configuration
- Standard preview
- Optional hints
- Unlimited rewind

### Master Baker
- Smaller or constrained board
- Partial queue visibility
- Complex orders and special plates
- No automatic danger warning
- Rewind available but reflected in optional records

### Custom Kitchen
Configure board size, mask, flavour count, cake size, queue, visibility, special frequency, orders, timer, rewind rules, tools, diagonal interaction, and completion behaviour.

All profiles allow campaign and collection progress. Higher difficulty gives prestige and alternate records, not exclusive story content.

## Respect My Time
Settings must include:
- Skip dialogue
- Faster or minimal animation
- Automatic ordinary reward collection
- Disable reminders
- Hide streak interfaces and promotional content
- Preferred session duration
- Natural stopping-point notice
- Suspend and resume any puzzle
- Reduced motion and particle intensity
- Disable screen shake and haptics
- Separate music, ambience, and effects volume

At the configured duration, show a non-blocking message that progress is saved and this is a natural place to stop. Never punish either choice.

## Non-punitive return systems
Do not use streak loss. Prefer:
- Any five daily puzzles in a rolling seven-day period.
- A monthly set completable at any time during the month.

Missed days do not erase progress. Do not use guilt messages, reduced rewards after absence, or fake scarcity.

## Economy and commercial guardrails
At most use:
- Coins for ordinary visual customization.
- Mastery stars for optional achievement recognition.
- Recipe stamps for collection progress.

Nothing earned is lost through failure or absence.

If commercialized later, allow only transparent options such as a one-time full-game purchase, substantial expansion packs, cosmetic supporter packs, visual themes, soundtrack or art packages, and optional clearly disclosed rewarded ads.

Never implement paid lives, undo, hints, consumable power bundles, loot boxes, manipulated sequences, forced ads, fake discounts, fake countdowns, or purchasable campaign victory.

## Player Promise
Display a concise promise:
1. Every campaign level is solvable without payment.
2. Sequences do not worsen because the player is winning.
3. Failure never removes earned progress.
4. Rewind and ordinary hints are free.
5. Purchases, if any, are cosmetic or substantial disclosed content.
6. Offline campaign play remains available.
7. Reminders are optional.
8. There are no fake countdowns.
9. The campaign has a real ending.
10. Player data is handled transparently.

## Phase 3 implementation notes
- **Timeline** is a tree of stable states. Undo, redo and scrubbing move a cursor; a different move from an earlier state starts a new branch; nothing is discarded. Playing the same move from the same state reuses the node. Restart goes to the start and keeps the timeline, unless the tray model setting changed, which starts a fresh timeline.
- **Hint ladder** (all rungs unlimited): 1 ring up to three cells, 2 two cells, 3 the recommended plate and cell, 4 label/value rows from real engine numbers, 5 the next two turns numbered on the board, 6 demonstration played onto a new branch that can be stopped or rewound. The badge says Solver-confirmed, Heuristic or No route.
- **Move evaluation** runs the real engine and a bounded solver per distinct move. Ranking is win, unknown, no-win, then shorter known line, more cakes, more empty cells, less fragmentation.
- **Teach Me** (setting) compares each played move with the evaluation of the position it was played from and shows You and Best columns.
- **Failure analysis** finds the last position with a solver-confirmed route by binary search along the lost line, which is valid because a position without a route never leads back to one. It reports the closing move, moves played afterwards, the most spread flavour, a missed completion and the best verified alternative. If the solver budget runs out the report says Best known.
- **Fair Bake receipts** live in `src/content/receipts.json`, one per level and tray model, with a hash of the level definition so edits mark a receipt outdated. Regenerate with `npm run verify-levels -- --write`. Each receipt stores a replayable solution; a unit test replays every one.
- Solver work runs in a Web Worker, with a main-thread fallback.
- Deferred: converting a failed board into a Rescue challenge (Phase 6).

## Phase 5 implementation notes
- **Hats**: one for winning, one for finishing within the move target, one for the level's mastery goal. Mastery never blocks progress. Goal kinds: chain depth, score, free spaces kept after every move, and no tools.
- **Move targets** are the best known winning line in the slower tray model plus 3. Best known is the shortest of the solver's line and the shortest winning game found by the simulation agents; lines are stored and replayed by a test.
- **Mastery goals** are chosen by `npm run mastery`, which only keeps a goal that ordinary play reaches in at least 10% of won games in both tray models, and stores a replayable witness line per model. A test replays every witness.
- **Suspend and resume**: the whole timeline (commands, branches, bookmarks, cursor) is saved after each stable change, per level, and restored by replaying with the real engine. A save made for a different level definition or tray model is discarded and the level starts fresh.
- Saves are versioned: settings and progress are version 2, with migrations from version 1. Export and import cover settings, progress and suspended puzzles.
- Dialogue is optional, short, skippable per set and globally.

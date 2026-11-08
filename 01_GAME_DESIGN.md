# 01: Core Game Design

## Board and input
- Default board: 4 columns by 5 rows.
- Orthogonal adjacency only initially.
- One plate per playable cell.
- Incoming tray contains three choices. A player setting selects the tray model: slot refill (default) or batch refill. See `00_RULES_SPEC.md`.
- Support tap-select then tap-cell, and drag-and-drop.
- Allow cancelling a selection.
- Before confirmation, preview valid cells, interacting plates, transfer directions, likely completions, cleared spaces, and order progress.

## Plates and slices
- Standard plate capacity: six radial slice positions.
- A plate may contain one to three flavours and empty positions.
- Every flavour requires colour, texture or pattern, and a small visual identifier. Never rely on colour alone.
- Begin with clean patterned wedges. Do not delay mechanical testing for final food art.

## Deterministic resolution
The formal algorithm, tie-breakers and termination proof are in `00_RULES_SPEC.md`, which wins over this summary. After placement:
1. Mark the placed plate as active.
2. Inspect neighbours in this order: top, right, bottom, left.
3. For each shared flavour, move slices toward the plate holding the larger group, subject to capacity.
4. On an equal group size, prefer the active plate.
5. If neither plate is active, use stable board-cell order as the final tie-breaker.
6. Repeat transfers until stable.
7. Detect all six-slice, single-flavour cakes.
8. Complete and remove them simultaneously.
9. Apply declared special effects.
10. Repeat until stable.
11. Update orders, score, history, and game status.

All tie-breakers must be explicit and tested. Resolution must always terminate.

## Chain reactions
Chain depth is the number of resolution rounds in one move that completed a cake (see `00_RULES_SPEC.md`: plates never move, so chains come from propagation). Track chain depth, cake count, flavours, spaces freed, order progress, and special effects. Initial labels:
- Depth 1: normal
- Depth 2: Sweet Combo
- Depth 3: Delicious
- Depth 4: Master Baker
- Depth 5 or more: Bakery Rush

Labels and thresholds must be data-driven.

## Customer orders
Support declarative objectives:
- Complete a specific flavour.
- Complete any number of cakes.
- Complete multiple distinct flavours.
- Complete identical cakes consecutively.
- Complete cakes in a specified order.
- Complete an order within a move target.
- Create a specified chain length.
- Complete without wild slices.
- Maintain a minimum number of empty cells.
- Rescue a specified board.
- Complete with restricted tools (a level modifier, not an order).

Orders have explicit states (active, complete, failed). A failed mandatory order means the level cannot be won from this state; the game offers rewind and never shames.

Example customer patterns:
- Couple: strawberry and chocolate.
- Birthday party: any three cakes.
- Food critic: one exact recipe efficiently.
- Wedding: two identical cakes consecutively.
- Festival: four different flavours.

## Win and loss
- Win when all mandatory order objectives are complete.
- Lose when no empty playable cell remains after stable resolution and no tool action frees one, or when the tray and queue are exhausted with orders incomplete (see `00_RULES_SPEC.md`).
- A full board is a genuine deadlock because placement needs an empty cell.

## Mastery
Each level may provide three chef hats:
1. Complete the order.
2. Finish within a suggested move count.
3. Complete a level-specific mastery goal.

Mastery may unlock recognition and cosmetics, but never blocks campaign progression.

## Special slices
Implement data-driven definitions, introduced slowly and only after the core is proven (behind ruleset flags):
- Wild cream: adopts an eligible flavour deterministically.
- Double layer: counts as two while occupying one position.
- Mystery slice: seeded hidden flavour revealed after placement. Previews redact it; the real engine is unchanged.
- Burnt slice: cannot join a normal cake until repaired or removed. The repair action must be defined in the rules spec before implementation.
- Wild and rainbow adoption rules must be written into the rules spec first. Rainbow slice: copies the largest eligible adjacent group with deterministic ties.
- Fresh fruit: must be used within a declared move count, without causing unavoidable normal-campaign failure.
- Golden slice: increases score or cosmetic reward, not solvability.

Introduce no more than one major mechanic every five to eight levels.

## Special plates
- Standard serving plate
- Lazy Susan: rotates transfer priority after moves.
- One-way plate: restricted send or receive direction.
- Locked plate: unlocks through a declared trigger.
- Cooling rack: delays clearing a completed cake.
- Golden plate: rewards completion under a condition.
- Cracked plate: reduced capacity until repaired.

Obstacles must create decisions, not arbitrary blockage.

## Earned chef tools
- Cake server: move one slice between adjacent plates.
- Turntable: rotate or change plate priority.
- Mixing bowl (deferred: breaks queue determinism): combine two incoming choices into a replacement.
- Oven mitt: relocate an existing plate.
- Whisk (deferred until wild cream is specified): transform an eligible slice into wild cream.
- Tasting spoon: preview future incoming sets.
- Bin: discard one incoming plate.

The first tool set is Cake server, Oven mitt, Tasting spoon and Bin. Proposed Sugar Energy:
- Complete cake: +1
- Chain of two or more: +1 bonus
- Complete order: +2
- At six energy: grant one tool of the player's choice

Tools must never be required for ordinary campaign solvability and must not be sold as consumables.

## Feedback sequence
Suggested merge animation:
1. Valid neighbours glow for about 100 ms.
2. Slices lift.
3. Slices arc for about 180 to 250 ms.
4. Destination compresses and rebounds.
5. Completed cake rises or rotates.
6. Crumbs and sparkles appear.
7. Completion sound plays.
8. Cake moves toward the order ticket or recipe book.
9. Plate clears.
10. Chain feedback begins.

Support fast animation, reduced motion, and skipping repetitive sequences. State changes may not depend on animation completion.

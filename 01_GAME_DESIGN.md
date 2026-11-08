# 01: Core Game Design

## Board and input
- Default board: 4 columns by 5 rows.
- Orthogonal adjacency only initially.
- One plate per playable cell.
- Incoming tray contains three choices.
- Support tap-select then tap-cell, and drag-and-drop.
- Allow cancelling a selection.
- Before confirmation, preview valid cells, interacting plates, transfer directions, likely completions, cleared spaces, and order progress.

## Plates and slices
- Standard plate capacity: six radial slice positions.
- A plate may contain one to three flavours and empty positions.
- Every flavour requires colour, texture or pattern, and a small visual identifier. Never rely on colour alone.
- Begin with clean patterned wedges. Do not delay mechanical testing for final food art.

## Deterministic resolution
After placement:
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
Track chain depth, cake count, flavours, spaces freed, order progress, and special effects. Initial labels:
- 1 completion: normal
- 2: Sweet Combo
- 3: Delicious
- 4: Master Baker
- 5 or more: Bakery Rush

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
- Complete with restricted tools.

Example customer patterns:
- Couple: strawberry and chocolate.
- Birthday party: any three cakes.
- Food critic: one exact recipe efficiently.
- Wedding: two identical cakes consecutively.
- Festival: four different flavours.

## Win and loss
- Win when all mandatory order objectives are complete.
- Lose only when no empty destination remains, resolution cannot free space, and no valid continuation remains.
- Verify genuine deadlock before declaring loss.

## Mastery
Each level may provide three chef hats:
1. Complete the order.
2. Finish within a suggested move count.
3. Complete a level-specific mastery goal.

Mastery may unlock recognition and cosmetics, but never blocks campaign progression.

## Special slices
Implement data-driven definitions, introduced slowly:
- Wild cream: adopts an eligible flavour deterministically.
- Double layer: counts as two while occupying one position.
- Mystery slice: seeded hidden flavour revealed after placement.
- Burnt slice: cannot join a normal cake until repaired or removed.
- Rainbow slice: copies the largest eligible adjacent group with deterministic ties.
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
- Mixing bowl: combine two incoming choices into a replacement.
- Oven mitt: relocate an existing plate.
- Whisk: transform an eligible slice into wild cream.
- Tasting spoon: preview future incoming sets.
- Bin: discard one incoming plate.

Proposed Sugar Energy:
- Complete cake: +1
- Chain of two or more: +1 bonus
- Complete order: +2
- At six energy: charge or choose one tool

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

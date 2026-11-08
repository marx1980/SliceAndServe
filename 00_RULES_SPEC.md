# 00: Formal Rules Specification

This is the authoritative definition of game rules. `01_GAME_DESIGN.md` describes intent; where they differ, this file wins. Every rule here has a unit test. Worked examples in `src/tests/unit/fixtures/` are golden tests.

## Glossary
- **Flavour**: a dessert type with an index. Flavour order is the order in the level's `flavors` list and is the only flavour ordering used anywhere.
- **Plate**: holds up to `capacity` slices (capacity = `cakeSize`, default 6). Slices are stored sorted by flavour index, so equal plates are equal states.
- **Cell**: board position. Cell order is row-major (row, then column).
- **Active plate**: the plate placed this move. It is active only during the first round.
- **Group**: the count of one flavour on one plate.
- **Round**: one cycle of transfers-until-stable followed by simultaneous completion.
- **Hot plate**: a plate that changed in the previous round.

## Tray and queue
A level has a fixed `queue` of plates (explicit or expanded from a seed before play). The tray has 3 slots. The tray mode is a player setting and never changes the queue order.

- **Slot mode (default)**: placing the plate in slot i fills slot i with the next queue plate. Unchosen plates stay.
- **Batch mode**: placing sets slot i to empty. When all slots are empty, all three refill from the queue in slot order.

When the queue is exhausted, slots stay empty. Both modes consume the queue in the same order.

Every campaign level is verified solvable in both modes.

## Placement
A command is `{ slot, row, column }`. It is legal when the slot holds a plate and the cell is playable and empty. The placed plate becomes the active plate.

## Resolution
Resolution runs in **rounds**. Plates never move between cells, so a cleared cake cannot create new adjacency. Chains therefore come from propagation: a round can free capacity or change group sizes, and the next round re-examines only the plates that changed.

Round 1 examines the active plate. Each later round examines only the plates that changed in the previous round (the **hot** plates). A round runs transfers until none applies, then completion. Resolution ends when a round changes nothing.

### Transfers (until stable within a round)
Build the candidate pair list, then apply the first applicable transfer and restart the scan. Stop when none applies.

1. Pair order: if an active plate exists, its pairs first in neighbour order top, right, bottom, left (with diagonals enabled the order is top, top-right, right, bottom-right, bottom, bottom-left, left, top-left). Then every other adjacent pair that includes a hot plate, ordered by the lower cell then neighbour order.
2. For a pair (A, B), flavours are tried in flavour order. A flavour is shared if both plates hold at least one.
3. Direction: the plate with the larger group is the destination. On equal groups, the active plate is the destination. If neither is active, the plate at the lower cell is the destination.
4. Amount: `k = min(source group, destination free capacity)`. If `k = 0` the transfer does not apply.
5. A plate left with no slices is removed and its cell becomes empty (a cleared space).

**Termination proof.** A transfer always moves slices to a group at least as large as the source group. Moving `k` slices from a group of size `a` to a group of size `b >= a` changes the sum of squared group sizes by `2k(b - a) + 2k^2 > 0`. That sum is bounded by the squared slice total, so only finitely many transfers happen, and so only finitely many rounds.

**Stability.** Boards are stable before a move (no applicable transfer anywhere). Only changed plates can create new transfers, so ending when a round changes nothing leaves a stable board.

### Completion
After a round's transfers are stable, every plate holding exactly `cakeSize` slices of one flavour is a completed cake. All are removed simultaneously. Cells become empty. The active plate designation ends after round 1.

## Chain depth and labels
Chain depth is the number of rounds in one move that completed at least one cake. Labels are data-driven (`ruleset.chainLabels`) and keyed on chain depth, not cake count.

## Orders
Orders are cumulative per level and mandatory unless marked optional.

- `complete-flavor { flavor, count }`: complete `count` cakes of a flavour.
- `complete-any { count }`: complete `count` cakes of any flavour.
- `complete-distinct { count }`: complete cakes of `count` different flavours.
- `chain { depth }`: reach chain depth `depth` in one move.

An order is `active` or `complete`. (Order states such as `failed` arrive with orders that can fail.)

## Status
After each move resolves:
1. **Won** if all mandatory orders are complete.
2. Else **lost** if there is no empty playable cell and no legal tool action frees one.
3. Else **lost** if the tray is empty and the queue is exhausted.
4. Else **playing**.

Because placement needs an empty cell, a full board is a genuine deadlock. Loss is never declared while an action remains.

## Determinism
- Resolution uses no randomness.
- Randomness is used only to expand a seed into a queue, with the seeded generator in `src/game/rules/rng.ts`.
- The same state and command always give the same result.

## Preview
A preview clones the state and runs the real engine. It returns the same events as the real move. Hidden information (future mystery slices) must be redacted by the caller, not by changing the engine.

## Deferred rules (not in the core)
Special slices, special plates, tools, diagonal interaction beyond the order above, and house rules sit behind `ruleset` flags and need entries in this file before implementation.

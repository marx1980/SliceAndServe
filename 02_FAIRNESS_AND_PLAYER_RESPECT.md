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

History entries include the previous and resulting state, move number, selection, destination, random-generator state, resolution events, completed cakes, and order progress. Rewind may affect optional mastery records, but never blocks completion or progression.

## Educational hint ladder
Hints are unlimited:
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

Normal campaign guidance:
- At least three viable first moves.
- At least five known winning routes.
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

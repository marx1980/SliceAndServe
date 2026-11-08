# 04: Content, Progression, and Modes

## Bakery restoration
Persistent areas:
1. Front counter
2. Kitchen
3. Display window
4. Tea garden
5. Chocolate room
6. Wedding-cake studio
7. Rooftop cafe

Upgrades provide transparent quality-of-life or content benefits such as recipe preview, customization, practice features, collections, customers, music, or editor pieces. Do not create mandatory power gates. Let players choose between two or three visual styles for major renovations.

## Recipe collection
Families:
- French patisserie
- Croatian desserts
- Italian classics
- Japanese sweets
- American bakery
- Seasonal collection

Include stylized Croatian recipes such as Madarica, Kremsnita, Makovnjaca, Orehnjaca, Rozata, and Rapska torta. Use correct diacritics in the user interface when assets and fonts support them.

Recipe pages may unlock plates, decorations, music, completion effects, outfits, and editor pieces. Never use paid randomized loot boxes.

## Characters
Keep story short and optional:
- Mira: retired owner and classic-recipe mentor
- Luka: apprentice focused on experiments and combos
- Sofia: food critic offering mastery challenges
- Niko: delivery rider introducing order sequences
- Ana: wedding planner offering multi-level events
- Bruno: rival baker offering weekly score challenges

A 15-level chapter normally contains one opening, two or three optional mid-chapter interactions, one closing, and one visible bakery change. Support global dialogue skipping.

## Campaign rhythm
Initial release: 30 levels. Later target: 12 chapters and about 180 main levels.

Recommended 15-level chapter:
- 1 to 3: introduce theme or mechanic
- 4 to 6: develop it
- 7: notable challenge
- 8 to 11: combine known mechanics
- 12: relief level
- 13 to 14: mastery challenges
- 15: customer event and bakery upgrade

Difficulty must not rise continuously. Include relief and experimentation levels. The campaign needs a real ending, such as a town festival, closing scenes, recipe-book completion, and credits.

## Modes
### Main Journey
Authored deterministic levels, orders, bakery restoration, recipes, and a real ending.

### Daily Bake
Same deterministic puzzle for all players. No paid tools. Score by moves, chains, and peak occupancy. Missed puzzles remain available for a reasonable period.

### Endless Service
Continue until full, with gradually increasing flavour and order complexity. Show the seed and generation rules.

### Rush Hour
Optional timed mode. Never impose time pressure on the main campaign.

### Recipe Challenge
Complete specified cakes in a fixed sequence, preferably with a visible or fixed queue.

### Puzzle of the Week
Handcrafted difficult board, unlimited attempts, community statistics, and no consumable entry.

### Zen Kitchen
No failure, score pressure, or economy pressure. Calm sorting with selectable goals.

### Rescue Kitchen
Start near full and recover under constraints. Support importing failed boards.

### Pass-the-Cake
Local cooperative play: alternate moves on one device with a shared order and optional separate tools.

## Bakery Workshop
After the vertical slice is stable, add an editor for board, mask, starting plates, slices, sequence, seed, orders, move target, tools, special pieces, queue visibility, win conditions, mastery, title, and description.

Before publishing, verify schema validity, at least one solution, estimated difficulty, shortest known solution, viable first moves, route diversity, and tool dependency.

Support share code copy/import and level JSON download/import without requiring a backend.

## House rules
Support serializable presets such as:
- Four, six, or eight slices per cake
- Diagonal transfers
- Completed cakes remaining as blockers
- Plate rotation
- Chain-only scoring
- Sequential orders
- Locked plate every third move
- Pattern-only identification
- One existing plate move per turn
- Full or hidden queue

Generate readable identifiers, for example `5x5-6S-DIAG-Q5-NOBOOST`.

## Social expansion, later only
After the offline game is proven, consider friends' bakeries, asynchronous same-puzzle duels, weekly cooperative catering totals, recipe comparisons, and curated community puzzles. Do not prioritize chat, guild administration, or real-time multiplayer.

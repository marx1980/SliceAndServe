# Slice & Serve

A delicious sorting puzzle that challenges your decisions, not your patience or wallet.

Place plates of cake slices on a board. Matching slices consolidate between adjacent plates. Six matching slices make a cake, which is served and removed.

## Status
See `plan.md` for the current task and decisions. Rules are specified in `00_RULES_SPEC.md`.

## Commands
- Install: `npm install`
- Run: `npm run dev`
- Test: `npm run test` (unit, property and solver checks)
- End-to-end: `npm run test:e2e` (set `PW_CHROME=/path/to/chrome` to use an installed Chrome)
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Build: `npm run build` (relative asset paths, works under a GitHub Pages subpath)
- Verify levels: `npm run verify-levels` (solver receipts for every level in both tray modes)
- Simulate: `npm run simulate -- --agent greedy --runs 1000 --mode batch --format csv`

## Notes
- Rules live in framework-independent TypeScript under `src/game`. Phaser only renders.
- The tray model (slot or batch) is a player setting; every level is verified in both.

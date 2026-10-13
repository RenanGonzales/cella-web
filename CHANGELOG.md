# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/) (0.x while in MVP).

## [0.7.0] - 2026-10-13

Needs cella-api 0.10.0.

### Added

- Receipt after checkout: "Add the receipt" opens a review of each line, matched to a product, with its price and how it moved since last time (↑ 9%). Matches and prices can be fixed; a product on two lines or an invalid price blocks saving. Saved prices become each product's last price.
  - In the demo the receipt is a sample made from what was bought, labelled "Sample receipt". Accounts with the reader turned on (`features.receipt_ai`) can take a photo instead: it is shrunk to 1568 px in the browser and read by Claude.
- History screen (replaces "Coming soon"): purchases grouped by month with what was paid and whether there was a receipt; each one opens with its items and prices, and its receipt can be added or reviewed again.
- Spending card ("Spent in October", against last month's amount, one bar per month) on the home screen and at the top of History.
- "Used this week" on the home screen: how many times "Use" was tapped and the most used products.
- Price history (a small line chart) in the product form.
- Invite: the invite code in the sidebar (and a button in the phone header) opens the invite link to copy; `/join/CODE` creates an account inside that household. Demo copies explain that they cannot be joined.
- Guided tour: two new steps, "Prices from the receipt" and "Check, then save" (14 steps on phones, 15 on large screens).

### Fixed

- Stock above the ideal no longer reads "32 of 12": the card says "+20 over ideal" and the full bar ends with a "+20" pill.

### Changed

- Tests: 84 in total.

## [0.6.0] - 2026-10-12

Needs cella-api 0.9.0.

### Added

- Stock health in blue tones, the deeper the healthier: Full (at the ideal), Good (above the minimum), Low (at the minimum, on the list), Out. Used on the storage area cards, products, the home screen and the shopping list.
- Storage area cards say the rules plainly ("Min 6 · Ideal 12", or "Buys when it runs out" when the minimum is zero), with a tick on the bar where the minimum is.
- Shopping list: each item shows "Has 1 L · min 3 L · ideal 6 L" next to how much to buy; in the store, how much is at home.
- "Where are you shopping?" when starting: any saved market, or "Somewhere else" (no plan, list by category). "No market" is also an option for sorting the list at home.
- Floor plan editor: duplicate in any direction (← ↑ ↓ →) and grow or shrink the market on any side with the + and − on each edge; the grid grows on the left or at the top when copies need the room.

### Changed

- The guided tour's "start shopping" step goes through the new market question.
- Tests: 71 in total.

## [0.5.0] - 2026-10-12

Needs cella-api 0.8.0 (floor plans).

### Added

- Floor plan editor (`/markets/:id`, large screens): a dotted grid where the market is rebuilt with aisles, walls, square and rectangular islands, an entrance and a checkout.
  - Drag to move, drag the corner to resize; keyboard too (arrows move, Shift + arrows resize, Delete, Ctrl/Cmd + D duplicates, Esc clears). Pieces never leave the grid or land on each other.
  - Shift + click selects several; "Duplicate right" and "Duplicate below" copy them next to the selection, growing the market when needed. Copying a row of aisles below builds a wholesale store with a cross aisle, and keeps the entrance and checkout at the front.
  - Market size (width and depth) adjustable, never cutting a piece.
  - Inspector: name (unique), type, categories; categories without a place can be dropped into the selected corridor with one tap.
- Walking route: an automatic zigzag from the entrance's corner (up one corridor, down the next), drawn as a numbered dotted line. Stores with two blocks of aisles choose between "Through the cross aisle" (default) and "Block by block". Route mode lets the order be picked by hand, with "Reset to zigzag".
- Markets without a plan get a first draft from their corridors ("Create floor plan"); the plan's order sorts the shopping list once saved.
- On phones, the market shows the route on a small plan and the walking order (editing stays on larger screens).
- Asks before leaving with unsaved changes.
- Tests: 62 in total (route engine, collisions, duplication, saving, keyboard editing, manual order).

## [0.4.0] - 2026-10-12

### Added

- Products screen: search by name, brand or category (accents ignored), filter by area, archived view; each row shows the stock against the ideal and whether it is on the list.
- Product form: name, brand, category (pick one or create it on the spot), area, unit, stock now, what one "Use" takes, minimum and ideal. Checked with the API's rules before sending (minimum not above the ideal, step above zero, up to 3 decimals, "0,5" accepted); edits send only what changed. Archive and restore.
- Markets screen: cards with chain, address and number of corridors, create, edit, archive and restore, and "Use for my list" to choose the market that sorts the shopping list.
- The sidebar search opens the products screen already filtered; the market name on the shopping list links to the markets screen.
- Tests: 41 in total.

### Fixed

- Adding a market no longer changes, by itself, the market that sorts the list.
- Favicon path under `/cella/`.

## [0.3.0] - 2026-10-12

Needs cella-api 0.7.0 (one private demo household per visitor).

### Added

- Guided tour of the demo (about a minute): the screen goes dark except the one spot to look at or tap, with a caption explaining it. Only that spot responds; steps move on with Next, a tap on the spot or the app's own events (consumed, started, split, checked out). Skip or Esc ends it; reduced motion is respected; the caption stays readable by screen readers over open dialogs.
- Tour steps: shopping list, areas, one-tap consume, automatic list, corridors, start shopping, check an item, split with Sam, both phones, Sam's live ticks, checkout.
- Two-phone page (`/demo`, large screens): Alex's and Sam's phones side by side in generic frames, each running the app with its own session. During the tour Sam shops his part for real (his own token, the same API calls his phone would make) while Alex watches the ticks arrive.
- On phones, "Switch to Sam's phone" in the store menu, since two phones do not fit on one screen.
- "Take the tour" in the menu: starts a fresh demo household and the tour from the beginning.

### Changed

- The demo keeps a second session (Sam's) next to Alex's; logging out ends both.
- The "Undo" message closes when leaving the screen where the item was used, and list messages sit above the main button.
- Tests: 34 in total (tour flow, blocked clicks, Skip/Esc, Sam's automation, sessions, two-phone page).

## [0.2.0] - 2026-10-12

### Added

- Shopping list screen: items grouped by the corridors of the chosen market, numbered in walking order ("Other" for unmapped categories), with brand, last price per unit and the estimated total.
- Planning at home: change how much to buy with a +/- stepper (by the product's step), remove items, add products by hand with a suggested quantity that fills them up to the ideal.
- In-store mode (focus mode on phones, without the bottom navigation): one tap puts an item in the cart, quantity actually bought, "not found" (moves to the next list), who picks it up; optimistic updates.
- Split the route between the people at the market, with "My route" / "Everyone" tabs; changes from other phones arrive within 3 seconds.
- Checkout: summary before finishing, then items added to stock, items moved to the next list and a cost estimate from the last prices.
- Notice when another phone finishes the shopping or the list changed under you (409).
- Tests for the list flow against an in-memory fake of the API (26 tests in total).

## [0.1.0] - 2026-10-12

### Added

- Project setup: Vite, React 19, strict TypeScript, MUI, TanStack Query, React Router under `/cella/`.
- Design system "Direction D": light canvas, navy palette, large light-weight numbers, segmented bars, stock rings, glow highlight card.
- Login page with one-click demo and email/password login; session token with automatic logout on 401.
- Animated logo intro for the demo (brush reveal, swash, drop and ripple), with "Take the tour" / "Explore on my own"; shown once per browser and respects reduced motion.
- App shell: collapsible desktop sidebar with household card (members, stocked %, invite code) and floating bottom navigation on phones.
- Home: shopping list summary (items, empty, at minimum, estimated cost), storage areas with stock level, items running low.
- Storage area page: products ordered by need, one-tap consume with optimistic update and undo snackbar.
- English and Brazilian Portuguese translations.
- Tests (Vitest + Testing Library), ESLint, Prettier and GitHub Actions CI.

[0.7.0]: https://github.com/RenanGonzales/cella-web/releases/tag/v0.7.0
[0.6.0]: https://github.com/RenanGonzales/cella-web/releases/tag/v0.6.0
[0.5.0]: https://github.com/RenanGonzales/cella-web/releases/tag/v0.5.0
[0.4.0]: https://github.com/RenanGonzales/cella-web/releases/tag/v0.4.0
[0.3.0]: https://github.com/RenanGonzales/cella-web/releases/tag/v0.3.0
[0.2.0]: https://github.com/RenanGonzales/cella-web/releases/tag/v0.2.0
[0.1.0]: https://github.com/RenanGonzales/cella-web/releases/tag/v0.1.0

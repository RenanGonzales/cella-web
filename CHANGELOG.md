# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/) (0.x while in MVP).

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

[0.3.0]: https://github.com/RenanGonzales/cella-web/releases/tag/v0.3.0
[0.2.0]: https://github.com/RenanGonzales/cella-web/releases/tag/v0.2.0
[0.1.0]: https://github.com/RenanGonzales/cella-web/releases/tag/v0.1.0

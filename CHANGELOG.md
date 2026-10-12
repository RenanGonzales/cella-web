# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/) (0.x while in MVP).

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

[0.1.0]: https://github.com/RenanGonzales/cella-web/releases/tag/v0.1.0

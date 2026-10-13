# Cella Web

Frontend for **Cella**, a household supplies manager. Track what you have at home, turn what runs out into a shopping list sorted by the aisles of _your_ store, and split the shopping route between the people going to the market.

> The name comes from the Latin _cella_, the Roman pantry.

**Status:** in development (MVP) · see [CHANGELOG](CHANGELOG.md)

## Stack

- React 19 + TypeScript (strict) + Vite
- MUI with a custom theme (Geist for the UI, Dancing Script for the logo)
- TanStack Query (cache, optimistic updates, polling of the shared list)
- React Router, served under `/cella` (Vite `base: '/cella/'` + router basename)
- i18next: English (default) and Brazilian Portuguese, picked from the browser
- Vitest + Testing Library, ESLint, Prettier, GitHub Actions

## Getting started

Requirements: Node 20+ and the [cella-api](https://github.com/RenanGonzales/cella-api) (0.8.0 or later) running locally with `DEMO_ENABLED=true`.

```bash
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:8000
npm run dev            # http://localhost:5173/cella/
```

Click **Try the demo**: the API creates a private demo household for you (Alex and Sam). Take the tour from the intro or from the menu; on a large screen it ends on the two-phone page (`/cella/demo`).

## Scripts

| Script              | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Dev server on port 5173             |
| `npm run build`     | Type-check and build to `dist/`     |
| `npm run preview`   | Serve the production build          |
| `npm run typecheck` | TypeScript only                     |
| `npm run lint`      | ESLint                              |
| `npm run format`    | Prettier (write)                    |
| `npm test`          | Unit and integration tests (Vitest) |

## Environment

| Variable       | Default      | Notes                                                   |
| -------------- | ------------ | ------------------------------------------------------- |
| `VITE_API_URL` | `/cella/api` | API base URL. In production nginx proxies `/cella/api`. |

## Project layout

```
src/
  api/         fetch client, types and TanStack Query hooks
  auth/        session context (JWT in localStorage, logout on 401)
  components/  design system (cards, rings, bars), app shell, logo intro, list, tour
  i18n/        en and pt-BR
  lib/         formatting, stock statistics, floor plan and route engine, tour state, Sam's automation
  pages/       login, welcome, home, storage area, shopping list, products, markets, floor plan, two-phone demo
  test/        test setup, factories and app-level tests
```

## MVP screens

- [x] **Demo intro:** animated logo, then take the tour or explore
- [x] **Home:** shopping list summary, storage areas with stock rings, items running low
- [x] **Storage area:** one tap to consume, with undo
- [x] **Shopping list:** sorted by the corridors of the selected market, with usual brand and last price
- [x] **In the store:** one tap per item, not found, quantity bought
- [x] **Split:** each household member sees only their own route, live across phones
- [x] **Checkout:** stock goes up, what was missing moves to the next list
- [x] **Guided tour:** spotlight on one spot at a time, with captions
- [x] **Two phones:** Alex and Sam side by side on large screens, Sam shopping live
- [x] **Catalog:** products with stock rules, categories, markets
- [x] **Market floor plan:** modular plan editor, zigzag route (also wholesale 2 x 8)
- [ ] **History:** purchases, prices, monthly spending, household invite

## Related

- Backend: [cella-api](https://github.com/RenanGonzales/cella-api)
- Project page: https://renangonzales.com/cella

## License

© 2026 Renan Gonzales. All rights reserved.

The source code is public for viewing and evaluation only. No permission is granted to use, copy, modify or distribute it without prior written consent.

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../i18n';
import i18n from '../i18n';
import type { Product, ShoppingList } from '../api/types';
import { makeProduct } from './factories';
import { apiPath, json, renderApp } from './render';

const fridge = { id: 'fridge', name: 'Fridge', position: 0 };
const pantry = { id: 'pantry', name: 'Pantry', position: 1 };

function fakeApi(products: Product[]) {
  const list: ShoppingList = {
    id: 'list-1',
    status: 'open',
    market_id: null,
    sorted_by_market_id: null,
    item_count: 1,
    groups: [
      {
        corridor_id: null,
        name: 'Dairy',
        items: [
          {
            id: 'item-milk',
            product_id: 'milk',
            name: 'Whole milk',
            brand: null,
            category: 'Dairy',
            unit: 'l',
            quantity_needed: 4,
            quantity_bought: null,
            status: 'pending',
            added_manually: false,
            assigned_user_id: null,
            last_price_cents: 549,
            current_quantity: 2,
            min_quantity: 2,
            ideal_quantity: 6,
          },
        ],
      },
    ],
  };
  const calls: string[] = [];

  const handler = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = apiPath(input);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url}`);

    if (url === '/auth/demo')
      return json({
        access_token: 'token',
        token_type: 'bearer',
        expires_in: 1,
        partner: { id: 'sam', name: 'Sam', access_token: 'sam-token' },
      });
    if (url === '/me')
      return json({
        id: 'alex',
        name: 'Alex',
        email: 'alex@demo.cella.app',
        household: {
          id: 'h',
          name: 'Demo House',
          invite_code: 'DEMO2026',
          members: [{ id: 'alex', name: 'Alex' }],
        },
        features: { receipt_ai: false, is_demo: true },
      });
    if (url === '/storage-areas') return json([fridge, pantry]);
    if (url === '/products') return json(products);
    if (url === '/shopping-list') return json(list);

    const consume = url.match(/^\/products\/(.+)\/consume$/);
    if (consume) {
      const product = products.find((candidate) => candidate.id === consume[1])!;
      product.current_quantity = Math.max(0, product.current_quantity - product.consume_step);
      return json({
        product,
        consumption_event_id: 'event-1',
        consumed: product.consume_step,
        added_to_list: true,
      });
    }
    if (url === '/consumption-events/event-1/undo') {
      const product = products.find((candidate) => candidate.id === 'milk')!;
      product.current_quantity += product.consume_step;
      return json({ product, restored: product.consume_step });
    }
    return json({ detail: 'Not found' }, 404);
  });

  vi.stubGlobal('fetch', handler);
  return { calls };
}

let products: Product[];

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
  products = [
    makeProduct({
      id: 'milk',
      name: 'Whole milk',
      unit: 'l',
      storage_area_id: 'fridge',
      ideal_quantity: 6,
      min_quantity: 2,
      current_quantity: 2,
      needs_restock: true,
    }),
    makeProduct({
      id: 'rice',
      name: 'Rice',
      unit: 'kg',
      storage_area_id: 'pantry',
      consume_step: 5,
      ideal_quantity: 6,
      current_quantity: 6,
    }),
  ];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Cella web', () => {
  it('sends visitors who are not logged in to the login page', async () => {
    fakeApi(products);
    renderApp('/');

    expect(await screen.findByRole('button', { name: 'Try the demo' })).toBeInTheDocument();
  });

  it('opens the demo with the intro, then the choice of tour', async () => {
    fakeApi(products);
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(await screen.findByRole('button', { name: 'Try the demo' }));
    // A tap anywhere skips the animation straight to the choice.
    await user.click(await screen.findByRole('img', { name: 'Cella' }));
    await user.click(await screen.findByRole('button', { name: 'Explore on my own' }));

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(localStorage.getItem('cella.introSeen')).toBe('1');
  });

  it('shows the shopping list summary and the areas on the home screen', async () => {
    localStorage.setItem('cella.token', 'token');
    fakeApi(products);
    renderApp('/');

    expect(await screen.findByText('Fridge')).toBeInTheDocument();
    expect(screen.getByText('Pantry')).toBeInTheDocument();
    expect(await screen.findByText('1 low')).toBeInTheDocument();
    expect(screen.getByText('$21')).toBeInTheDocument(); // 4 L x $5.49 = $21.96
    expect(screen.getByText('.96')).toBeInTheDocument();
  });

  it('consumes a product and undoes it from the snackbar', async () => {
    localStorage.setItem('cella.token', 'token');
    const { calls } = fakeApi(products);
    const user = userEvent.setup();
    renderApp('/areas/fridge');

    await user.click(await screen.findByRole('button', { name: 'Use 1 L of Whole milk' }));

    const snackbar = await screen.findByRole('alert');
    expect(within(snackbar).getByText('Whole milk used · 1 L left')).toBeInTheDocument();
    expect(calls).toContain('POST /products/milk/consume');

    await user.click(within(snackbar).getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(calls).toContain('POST /consumption-events/event-1/undo'));
    expect(await screen.findByText('Undone')).toBeInTheDocument();
  });

  it('logs out when the API says the session is no longer valid', async () => {
    localStorage.setItem('cella.token', 'expired');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ detail: 'Not authenticated' }), { status: 401 }),
      ),
    );
    renderApp('/');

    expect(await screen.findByRole('button', { name: 'Try the demo' })).toBeInTheDocument();
    expect(localStorage.getItem('cella.token')).toBeNull();
  });
});

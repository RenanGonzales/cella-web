import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '../i18n';
import type { Layout } from '../lib/plan';
import { apiPath, json, renderApp } from './render';

const layout: Layout = {
  market_id: 'm1',
  plan: { cols: 12, rows: 9 },
  route_style: 'column',
  unmapped_categories: [{ id: 'paper', name: 'Paper Goods' }],
  corridors: [
    {
      id: 'in',
      name: 'Entrance',
      position: 0,
      kind: 'entrance',
      x: 0,
      y: 8,
      w: 3,
      h: 1,
      categories: [],
    },
    {
      id: 'produce',
      name: 'Produce',
      position: 1,
      kind: 'island',
      x: 0,
      y: 1,
      w: 2,
      h: 5,
      categories: [{ id: 'veg', name: 'Produce' }],
    },
    {
      id: 'dairy',
      name: 'Dairy',
      position: 2,
      kind: 'aisle',
      x: 3,
      y: 1,
      w: 1,
      h: 5,
      categories: [{ id: 'dairy-cat', name: 'Dairy' }],
    },
    {
      id: 'out',
      name: 'Checkout',
      position: 3,
      kind: 'checkout',
      x: 6,
      y: 8,
      w: 4,
      h: 1,
      categories: [],
    },
  ],
};

function fakeApi() {
  const puts: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = apiPath(input).split('?')[0];
      if (path === '/markets')
        return json([
          {
            id: 'm1',
            name: 'Neighborhood Market',
            chain: null,
            address: null,
            corridor_count: 2,
            has_plan: true,
            archived_at: null,
          },
        ]);
      if (path === '/markets/m1/layout' && init?.method === 'PUT') {
        puts.push(JSON.parse(String(init.body)));
        return json(layout);
      }
      if (path === '/markets/m1/layout') return json(layout);
      if (path === '/me')
        return json({
          id: 'a',
          name: 'Alex',
          email: 'a@x',
          household: { id: 'h', name: 'H', invite_code: 'X', members: [] },
          features: { receipt_ai: false, is_demo: true },
        });
      if (path === '/products') return json([]);
      if (path === '/shopping-list')
        return json({
          id: null,
          status: null,
          market_id: null,
          sorted_by_market_id: null,
          item_count: 0,
          groups: [],
        });
      return json({ detail: 'Not found' }, 404);
    }),
  );
  return { puts };
}

const piece = (name: string) =>
  document.querySelector<HTMLElement>(`button[data-piece][aria-label^="${name}"]`)!;

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('cella.token', 'token');
  await i18n.changeLanguage('en');
  // Large screen: the editor (not the phone view).
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe('Floor plan editor', () => {
  it('shows the plan with its zigzag route and the categories without a place', async () => {
    fakeApi();
    renderApp('/markets/m1');

    expect(await screen.findByRole('heading', { name: 'Neighborhood Market' })).toBeInTheDocument();
    expect(screen.getByText('2 stops · 1 category without a place')).toBeInTheDocument();
    expect(piece('Produce')).toHaveAccessibleName('Produce, stop 1');
    expect(piece('Dairy')).toHaveAccessibleName('Dairy, stop 2');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('adds a square, moves it with the keyboard and saves the plan in walking order', async () => {
    const api = fakeApi();
    const user = userEvent.setup();
    renderApp('/markets/m1');
    await screen.findByRole('heading', { name: 'Neighborhood Market' });

    await user.click(screen.getByRole('button', { name: 'Square' }));
    const square = piece('Square');
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    square.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Shift>}{ArrowRight}{/Shift}');

    // Name it and give it the category that had no place.
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Fruit');
    await user.click(screen.getByRole('button', { name: 'Paper Goods' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.puts).toHaveLength(1));
    const body = api.puts[0] as { plan: unknown; corridors: Record<string, unknown>[] };
    expect(body.plan).toEqual({ cols: 12, rows: 9 });
    expect(body.corridors.map((c) => c.name)).toEqual([
      'Entrance',
      'Produce',
      'Dairy',
      'Fruit',
      'Checkout',
    ]);
    // Placed at the first free spot (x 4, y 0), moved down 2 and widened by 1.
    expect(body.corridors[3]).toMatchObject({
      kind: 'island',
      x: 4,
      y: 2,
      w: 3,
      h: 2,
      category_ids: ['paper'],
    });
    expect(body.corridors[3]).not.toHaveProperty('id');
    expect(await screen.findByText('Floor plan saved')).toBeInTheDocument();
  });

  it('never moves a piece on top of another one', async () => {
    const api = fakeApi();
    const user = userEvent.setup();
    renderApp('/markets/m1');
    await screen.findByRole('heading', { name: 'Neighborhood Market' });

    await user.click(piece('Produce'));
    piece('Produce').focus();
    // One step fits (x 0 -> 1); the next would land on Dairy, so it is ignored.
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.puts).toHaveLength(1));
    const corridors = (api.puts[0] as { corridors: Record<string, unknown>[] }).corridors;
    expect(corridors.find((c) => c.name === 'Produce')).toMatchObject({ x: 1, w: 2 });
  });

  it('copies a selection below, making room and keeping the entrance at the front', async () => {
    const api = fakeApi();
    const user = userEvent.setup();
    renderApp('/markets/m1');
    await screen.findByRole('heading', { name: 'Neighborhood Market' });

    await user.click(piece('Dairy'));
    await user.click(screen.getByRole('button', { name: 'Duplicate below' }));
    expect(screen.getByText('3 stops · 1 category without a place')).toBeInTheDocument();
    expect(screen.getByText(/^12 × 14 cells/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.puts).toHaveLength(1));
    const corridors = (api.puts[0] as { corridors: Record<string, unknown>[] }).corridors;
    expect(corridors.find((c) => c.name === 'Dairy 2')).toMatchObject({
      x: 3,
      y: 7,
      category_ids: [],
    });
    expect(corridors.find((c) => c.name === 'Entrance')).toMatchObject({ y: 13 });
  });

  it('lets the walking order be chosen by hand, and goes back to the zigzag', async () => {
    fakeApi();
    const user = userEvent.setup();
    renderApp('/markets/m1');
    await screen.findByRole('heading', { name: 'Neighborhood Market' });

    await user.click(screen.getByRole('tab', { name: 'Route' }));
    await user.click(piece('Dairy'));
    const order = screen.getByRole('region', { name: 'Walking order' });
    expect(
      within(order)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['1DairyDown', '2ProduceUp']);
    await user.click(screen.getByRole('button', { name: 'Reset to zigzag' }));
    expect(within(order).getAllByRole('listitem')[0]).toHaveTextContent('Produce');
  });
});

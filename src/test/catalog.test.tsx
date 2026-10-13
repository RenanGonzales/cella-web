import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Market, Product } from '../api/types';
import i18n from '../i18n';
import {
  changedFields,
  formFromProduct,
  parseQuantity,
  toInput,
  validateProduct,
} from '../lib/productForm';
import { makeProduct } from './factories';
import { apiPath, json, renderApp } from './render';

const AREAS = [
  { id: 'fridge', name: 'Fridge', position: 0 },
  { id: 'pantry', name: 'Pantry', position: 1 },
];

function fakeApi() {
  const products: Product[] = [
    makeProduct({
      id: 'milk',
      name: 'Whole milk',
      brand: 'Valley Farm',
      storage_area_id: 'fridge',
      category_id: 'dairy',
    }),
    makeProduct({ id: 'rice', name: 'Rice', storage_area_id: 'pantry', category_id: 'grains' }),
  ];
  const categories = [
    { id: 'dairy', name: 'Dairy' },
    { id: 'grains', name: 'Grains' },
  ];
  const markets: Market[] = [
    {
      id: 'm-b',
      name: 'Neighborhood Market',
      chain: null,
      address: null,
      corridor_count: 10,
      has_plan: false,
      archived_at: null,
    },
  ];
  const writes: { method: string; path: string; body?: unknown }[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const [path = '', query = ''] = apiPath(input).split('?');
      const method = init?.method ?? 'GET';
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : undefined;
      if (method !== 'GET') writes.push({ method, path, body });
      const archived = query.includes('include_archived=true');

      if (path === '/me')
        return json({
          id: 'alex',
          name: 'Alex',
          email: 'a@x',
          household: { id: 'h', name: 'Home', invite_code: 'X', members: [] },
          features: { receipt_ai: false, is_demo: true },
        });
      if (path === '/storage-areas') return json(AREAS);
      if (path === '/shopping-list')
        return json({
          id: null,
          status: null,
          market_id: null,
          sorted_by_market_id: null,
          item_count: 0,
          groups: [],
        });
      if (path === '/categories' && method === 'POST') {
        const category = { id: `cat-${String(body?.name)}`, name: String(body?.name) };
        categories.push(category);
        return json(category, 201);
      }
      if (path === '/categories') return json(categories);
      if (path === '/products' && method === 'POST') {
        const product = makeProduct({ ...(body as Partial<Product>), id: 'new-product' });
        products.push(product);
        return json(product, 201);
      }
      if (path === '/products')
        return json(products.filter((product) => archived || product.archived_at === null));
      const productAction = path.match(/^\/products\/([^/]+)(?:\/(archive|restore))?$/);
      if (productAction) {
        const product = products.find((candidate) => candidate.id === productAction[1])!;
        if (productAction[2] === 'archive') product.archived_at = '2026-10-12T00:00:00Z';
        else if (productAction[2] === 'restore') product.archived_at = null;
        else Object.assign(product, body);
        return json(product);
      }
      if (path === '/markets' && method === 'POST') {
        const market = {
          ...(body as unknown as Market),
          id: 'm-a',
          corridor_count: 0,
          archived_at: null,
        };
        markets.push(market);
        markets.sort((a, b) => a.name.localeCompare(b.name));
        return json(market, 201);
      }
      if (path === '/markets')
        return json(markets.filter((market) => archived || !market.archived_at));
      return json({ detail: 'Not found' }, 404);
    }),
  );
  return { writes, products };
}

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('cella.token', 'token');
  await i18n.changeLanguage('en');
});

afterEach(() => vi.unstubAllGlobals());

describe('Product form rules', () => {
  it('reads decimals typed with a comma or a dot, up to three places', () => {
    expect(parseQuantity('0,5')).toBe(0.5);
    expect(parseQuantity(' 12 ')).toBe(12);
    expect(parseQuantity('0.125')).toBe(0.125);
    expect(parseQuantity('0.1255')).toBeNull();
    expect(parseQuantity('-1')).toBeNull();
    expect(parseQuantity('')).toBeNull();
  });

  it('checks the same rules as the API before sending', () => {
    const form = {
      ...formFromProduct(makeProduct()),
      name: ' ',
      step: '0',
      minimum: '5',
      ideal: '2',
      categoryId: null,
    };
    expect(validateProduct(form)).toEqual({
      name: 'products.errors.name',
      categoryId: 'products.errors.category',
      step: 'products.errors.step',
      minimum: 'products.errors.minAboveIdeal',
    });
  });

  it('sends only what changed when editing', () => {
    const product = makeProduct({ name: 'Milk', brand: 'Valley', ideal_quantity: 6 });
    const input = toInput({ ...formFromProduct(product), ideal: '8', brand: '' });
    expect(changedFields(product, input)).toEqual({ ideal_quantity: 8, brand: null });
  });
});

describe('Products screen', () => {
  it('searches by name, brand or category, also from the address', async () => {
    fakeApi();
    const user = userEvent.setup();
    renderApp('/products?q=valley');

    expect(await screen.findByRole('button', { name: 'Edit Whole milk' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Rice' })).not.toBeInTheDocument();

    const search = screen.getAllByRole('searchbox', { name: 'Search products' }).at(-1)!;
    await user.clear(search);
    await user.type(search, 'grains');
    expect(await screen.findByRole('button', { name: 'Edit Rice' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Whole milk' })).not.toBeInTheDocument();
  });

  it('creates a product with a new category, after fixing the minimum', async () => {
    const api = fakeApi();
    const user = userEvent.setup();
    renderApp('/products');

    await user.click(await screen.findByRole('button', { name: 'New product' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Black pepper');
    await user.type(within(dialog).getByRole('combobox', { name: 'Category' }), 'Spices');
    await user.click(await screen.findByRole('option', { name: 'Create "Spices"' }));
    await user.click(within(dialog).getByRole('radio', { name: 'Pantry' }));
    await user.click(within(dialog).getByRole('radio', { name: 'g' }));
    const minimum = within(dialog).getByLabelText('Minimum');
    await user.clear(minimum);
    await user.type(minimum, '5');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(within(dialog).getByText('The minimum cannot be above the ideal.')).toBeInTheDocument();
    expect(api.writes.filter((write) => write.path === '/products')).toHaveLength(0);

    await user.clear(minimum);
    await user.type(minimum, '0,5');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Black pepper added')).toBeInTheDocument();
    expect(api.writes).toEqual([
      { method: 'POST', path: '/categories', body: { name: 'Spices' } },
      {
        method: 'POST',
        path: '/products',
        body: {
          name: 'Black pepper',
          brand: null,
          category_id: 'cat-Spices',
          storage_area_id: 'pantry',
          unit: 'g',
          consume_step: 1,
          min_quantity: 0.5,
          ideal_quantity: 2,
          current_quantity: 0,
        },
      },
    ]);
  });

  it('archives a product and brings it back from the archive', async () => {
    const api = fakeApi();
    const user = userEvent.setup();
    renderApp('/products');

    await user.click(await screen.findByRole('button', { name: 'Edit Rice' }));
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Edit Rice' })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('checkbox', { name: 'Archived' }));
    await user.click(await screen.findByRole('button', { name: 'Edit Rice' }));
    await user.click(screen.getByRole('button', { name: 'Restore' }));

    expect(await screen.findByText('Rice restored')).toBeInTheDocument();
    expect(api.writes.map((write) => write.path)).toEqual([
      '/products/rice/archive',
      '/products/rice/restore',
    ]);
  });
});

describe('Markets screen', () => {
  it('adds a market without changing how the list is sorted', async () => {
    const api = fakeApi();
    const user = userEvent.setup();
    renderApp('/markets');

    expect(
      within(await screen.findByRole('region', { name: 'Neighborhood Market' })).getByText(
        'Sorting your list',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New market' }));
    await user.type(screen.getByLabelText('Name'), 'Corner Store');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // "Corner Store" comes first alphabetically, but the list keeps its market.
    const corner = await screen.findByRole('region', { name: 'Corner Store' });
    expect(within(corner).queryByText('Sorting your list')).not.toBeInTheDocument();
    expect(localStorage.getItem('cella.market')).toBe('m-b');
    expect(api.writes[0]).toEqual({
      method: 'POST',
      path: '/markets',
      body: { name: 'Corner Store', chain: null, address: null },
    });

    await user.click(within(corner).getByRole('button', { name: 'Use for my list' }));
    expect(within(corner).getByText('Sorting your list')).toBeInTheDocument();
    expect(localStorage.getItem('cella.market')).toBe('m-a');
  });
});

describe('Storage area screen', () => {
  it('shows each product health with its minimum and ideal', async () => {
    const api = fakeApi();
    Object.assign(api.products[0]!, {
      current_quantity: 1,
      min_quantity: 2,
      ideal_quantity: 6,
      needs_restock: true,
    });
    Object.assign(api.products[1]!, { current_quantity: 1, min_quantity: 0, ideal_quantity: 1 });
    renderApp('/areas/fridge');

    expect(await screen.findByText('Low · on the list')).toBeInTheDocument();
    expect(screen.getByText(/Min 2 · Ideal 6/)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '1 in stock · minimum 2 · ideal 6' }),
    ).toBeInTheDocument();
  });

  it('says when an item is only bought once it runs out', async () => {
    const api = fakeApi();
    Object.assign(api.products[0]!, { current_quantity: 1, min_quantity: 0, ideal_quantity: 1 });
    renderApp('/areas/fridge');

    expect(await screen.findByText(/Buys when it runs out · Ideal 1/)).toBeInTheDocument();
    expect(screen.getByText('Full')).toBeInTheDocument();
  });
});

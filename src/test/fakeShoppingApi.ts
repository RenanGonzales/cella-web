import { vi } from 'vitest';

import type { Market, Product, PurchaseDetail, ShoppingList, ShoppingListItem } from '../api/types';
import { makeProduct } from './factories';
import { apiPath, json } from './render';

export const ALEX = { id: 'alex', name: 'Alex' };
export const SAM = { id: 'sam', name: 'Sam' };
export const MARKET: Market = {
  id: 'market-1',
  name: 'Neighborhood Market',
  chain: null,
  address: null,
  corridor_count: 2,
  has_plan: false,
  archived_at: null,
};

/** Corridors of the market in walking order, by category. */
const CORRIDORS = [
  { id: 'corridor-produce', name: 'Produce', categories: ['Produce'] },
  { id: 'corridor-dairy', name: 'Dairy', categories: ['Dairy'] },
];

type Item = ShoppingListItem;

function item(overrides: Partial<Item> & Pick<Item, 'id' | 'product_id' | 'name'>): Item {
  return {
    brand: null,
    category: 'Dairy',
    unit: 'un',
    quantity_needed: 1,
    quantity_bought: null,
    status: 'pending',
    added_manually: false,
    assigned_user_id: null,
    last_price_cents: null,
    current_quantity: 0,
    min_quantity: 1,
    ideal_quantity: 4,
    ...overrides,
  };
}

/**
 * In-memory stand-in for the shopping endpoints of cella-api, following the same rules
 * (statuses, split by corridor blocks, checkout). Every call is recorded in `calls`.
 */
export function fakeShoppingApi(
  options: { status?: 'open' | 'shopping'; receiptAi?: boolean; demo?: boolean } = {},
) {
  const products: Product[] = [
    makeProduct({ id: 'milk', name: 'Whole milk', unit: 'l', current_quantity: 2 }),
    makeProduct({ id: 'lettuce', name: 'Lettuce', current_quantity: 0 }),
    makeProduct({ id: 'soap', name: 'Soap bar', current_quantity: 1 }),
    makeProduct({
      id: 'pasta',
      name: 'Pasta',
      unit: 'kg',
      consume_step: 0.5,
      ideal_quantity: 2,
      current_quantity: 1,
    }),
  ];
  const state = {
    status: options.status ?? 'open',
    marketId: options.status === 'shopping' ? MARKET.id : (null as string | null),
    items: [
      item({
        id: 'item-milk',
        product_id: 'milk',
        name: 'Whole milk',
        brand: 'Valley Farm',
        unit: 'l',
        quantity_needed: 4,
        last_price_cents: 549,
        current_quantity: 2,
        min_quantity: 2,
        ideal_quantity: 6,
      }),
      item({
        id: 'item-lettuce',
        product_id: 'lettuce',
        name: 'Lettuce',
        category: 'Produce',
        last_price_cents: 399,
      }),
      item({ id: 'item-soap', product_id: 'soap', name: 'Soap bar', category: 'Personal Care' }),
    ],
  };
  const purchases: PurchaseDetail[] = [];
  const calls: { method: string; path: string; body?: unknown }[] = [];

  const view = (marketId: string | null): ShoppingList => {
    const sortBy = state.marketId ?? marketId;
    const groups: ShoppingList['groups'] = [];
    if (sortBy) {
      for (const corridor of CORRIDORS) {
        const items = state.items.filter((it) => corridor.categories.includes(it.category));
        if (items.length) groups.push({ corridor_id: corridor.id, name: corridor.name, items });
      }
      const other = state.items.filter(
        (it) => !CORRIDORS.some((corridor) => corridor.categories.includes(it.category)),
      );
      if (other.length) groups.push({ corridor_id: null, name: 'Other', items: other });
    } else {
      for (const category of [...new Set(state.items.map((it) => it.category))].sort()) {
        groups.push({
          corridor_id: null,
          name: category,
          items: state.items.filter((it) => it.category === category),
        });
      }
    }
    return {
      id: state.items.length ? 'list-1' : null,
      status: state.items.length ? (state.status as ShoppingList['status']) : null,
      market_id: state.marketId,
      sorted_by_market_id: sortBy,
      item_count: state.items.length,
      groups,
    };
  };

  const handler = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const [path = '', query = ''] = apiPath(input).split('?');
    const method = init?.method ?? 'GET';
    const body = init?.body
      ? (JSON.parse(String(init.body)) as Record<string, unknown>)
      : undefined;
    calls.push({ method, path, body });
    const marketParam = new URLSearchParams(query).get('market_id');

    if (path === '/me')
      return json({
        ...ALEX,
        email: 'alex@demo.cella.app',
        household: { id: 'h', name: 'Demo House', invite_code: 'DEMO2026', members: [ALEX, SAM] },
        features: { receipt_ai: options.receiptAi ?? false, is_demo: options.demo ?? true },
      });
    if (path === '/purchases') return json(purchases);
    if (path.startsWith('/stats/spending'))
      return json([{ month: '2026-10', paid_cents: 0, purchases: purchases.length }]);
    if (path.startsWith('/stats/consumption')) return json({ days: 7, times: 0, products: [] });
    if (/^\/products\/[^/]+\/prices$/.test(path)) return json([]);
    const purchaseMatch = path.match(/^\/purchases\/([^/]+)(\/receipt(\/sample)?)?$/);
    if (purchaseMatch) {
      const purchase = purchases.find((candidate) => candidate.id === purchaseMatch[1]);
      if (!purchase) return json({ detail: 'Purchase not found' }, 404);
      if (purchaseMatch[3]) {
        // Sample receipt: one line per item bought (at $2.49, last time $2.29) and a bag.
        return json({
          source: 'sample',
          store_name: 'NEIGHBORHOOD MARKET',
          purchased_on: '2026-10-12',
          total_cents: purchase.items.length * 249 + 15,
          lines: [
            ...purchase.items.map((bought) => ({
              text: bought.name.toUpperCase(),
              quantity: 1,
              unit_price_cents: 249,
              line_total_cents: 249,
              product_id: bought.product_id,
              previous_price_cents: 229,
            })),
            {
              text: 'SHOPPING BAG',
              quantity: 1,
              unit_price_cents: 15,
              line_total_cents: 15,
              product_id: null,
              previous_price_cents: null,
            },
          ],
        });
      }
      if (purchaseMatch[2] && method === 'PUT') {
        const prices = body?.prices as { product_id: string; unit_price_cents: number }[];
        purchase.items = purchase.items.map((bought) => {
          const price = prices.find((entry) => entry.product_id === bought.product_id);
          return price
            ? {
                ...bought,
                unit_price_cents: price.unit_price_cents,
                line_total_cents: price.unit_price_cents,
              }
            : bought;
        });
        purchase.receipt_source = body?.source as PurchaseDetail['receipt_source'];
        purchase.receipt_total_cents = body?.total_cents as number;
        purchase.paid_cents = body?.total_cents as number;
        purchase.items_without_price = 0;
        return json(purchase);
      }
      return json(purchase);
    }
    if (path === '/markets') return json([MARKET]);
    if (path === '/products') return json(products);
    if (path === '/storage-areas') return json([]);
    if (path === '/shopping-list') return json(view(marketParam));

    if (path === '/shopping-list/items' && method === 'POST') {
      const product = products.find((candidate) => candidate.id === body?.product_id)!;
      state.items.push(
        item({
          id: `item-${product.id}`,
          product_id: product.id,
          name: product.name,
          category: 'Grains',
          unit: product.unit,
          quantity_needed: body?.quantity_needed as number,
          added_manually: true,
        }),
      );
      return json(view(null), 201);
    }
    const itemMatch = path.match(/^\/shopping-list\/items\/(.+)$/);
    if (itemMatch) {
      const index = state.items.findIndex((it) => it.id === itemMatch[1]);
      if (index === -1) return json({ detail: 'Shopping list item not found' }, 404);
      if (method === 'DELETE') {
        state.items.splice(index, 1);
        return new Response(null, { status: 204 });
      }
      const current = state.items[index]!;
      const next = { ...current, ...(body as Partial<Item>) };
      next.quantity_bought =
        next.status === 'checked'
          ? ((body?.quantity_bought as number | undefined) ?? current.quantity_needed)
          : null;
      state.items[index] = next;
      return json(view(null));
    }
    if (path === '/shopping-list/start') {
      state.status = 'shopping';
      state.marketId = body?.market_id as string;
      return json(view(null));
    }
    if (path === '/shopping-list/cancel') {
      state.status = 'open';
      state.marketId = null;
      state.items = state.items.map((it) => ({
        ...it,
        status: 'pending',
        quantity_bought: null,
        assigned_user_id: null,
      }));
      return json(view(null));
    }
    if (path === '/shopping-list/split') {
      // Same idea as the API: neighboring corridors in blocks, here one corridor each.
      const userIds = body?.user_ids as string[];
      view(null).groups.forEach((group, index) => {
        const owner = userIds[Math.min(index, userIds.length - 1)]!;
        group.items.forEach((groupItem) => {
          const stored = state.items.find((it) => it.id === groupItem.id)!;
          stored.assigned_user_id = owner;
        });
      });
      return json(view(null));
    }
    if (path === '/shopping-list/checkout') {
      const bought = state.items.filter((it) => it.status === 'checked');
      state.items = state.items
        .filter((it) => it.status !== 'checked')
        .map((it) => ({ ...it, status: 'pending', assigned_user_id: null }));
      state.status = 'open';
      state.marketId = null;
      purchases.unshift({
        id: 'purchase-1',
        market_id: null,
        market_name: null,
        started_at: null,
        completed_at: '2026-10-12T15:00:00Z',
        items_bought: bought.length,
        items_without_price: bought.length,
        total_cents: 0,
        receipt_source: null,
        receipt_total_cents: null,
        paid_cents: 0,
        items: bought.map((it) => ({
          id: it.id,
          product_id: it.product_id,
          name: it.name,
          brand: it.brand,
          unit: it.unit,
          status: 'checked',
          quantity_bought: it.quantity_bought,
          unit_price_cents: null,
          line_total_cents: null,
        })),
      });
      return json({
        purchase_id: 'purchase-1',
        items_bought: bought.length,
        items_carried_over: state.items.length,
        total_cents: 0,
        items_without_price: bought.length,
      });
    }
    return json({ detail: 'Not found' }, 404);
  });

  vi.stubGlobal('fetch', handler);
  return {
    calls,
    state,
    /** Calls other than plain reads. */
    writes: () => calls.filter((call) => call.method !== 'GET'),
    purchases,
  };
}

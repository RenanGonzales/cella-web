import { describe, expect, it } from 'vitest';

import { applyItemChanges } from '../api/hooks';
import type { ShoppingList, ShoppingListItem } from '../api/types';
import { makeProduct } from '../test/factories';
import { cartStats, listSections, suggestedQuantity, unitPrice } from './shopping';

function item(overrides: Partial<ShoppingListItem>): ShoppingListItem {
  return {
    id: 'item',
    product_id: 'product',
    name: 'Item',
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

const list: ShoppingList = {
  id: 'list',
  status: 'shopping',
  market_id: 'market',
  sorted_by_market_id: 'market',
  item_count: 3,
  groups: [
    { corridor_id: 'c1', name: 'Produce', items: [item({ id: 'a', assigned_user_id: 'alex' })] },
    { corridor_id: 'c2', name: 'Dairy', items: [item({ id: 'b', assigned_user_id: 'sam' })] },
    { corridor_id: null, name: 'Other', items: [item({ id: 'c', assigned_user_id: 'sam' })] },
  ],
};

describe('shopping helpers', () => {
  it('numbers corridors from the whole list, even when showing one route', () => {
    const titles = (onlyUserId?: string) =>
      listSections(list, { onlyUserId, otherLabel: 'Others' }).map((section) => section.title);
    expect(titles()).toEqual(['1 · Produce', '2 · Dairy', 'Others']);
    expect(titles('sam')).toEqual(['2 · Dairy', 'Others']);
    expect(
      listSections({ ...list, sorted_by_market_id: null }, { otherLabel: 'Others' }).map(
        (section) => section.title,
      ),
    ).toEqual(['Produce', 'Dairy', 'Other']);
  });

  it('adds up the cart with what was actually bought', () => {
    const stats = cartStats([
      item({ status: 'checked', quantity_needed: 4, quantity_bought: 2, last_price_cents: 549 }),
      item({ status: 'checked' }),
      item({ status: 'not_found', last_price_cents: 100 }),
      item({}),
    ]);
    expect(stats).toEqual({
      total: 4,
      checked: 2,
      notFound: 1,
      pending: 1,
      cartCents: 1098,
      unpriced: 1,
    });
  });

  it('suggests whole steps up to the ideal and shows unit prices', () => {
    const product = (current: number) =>
      makeProduct({ consume_step: 0.5, ideal_quantity: 2, current_quantity: current });
    expect(suggestedQuantity(product(0.2))).toBe(2);
    expect(suggestedQuantity(product(1))).toBe(1);
    expect(suggestedQuantity(product(3))).toBe(0.5); // already full: at least one step
    expect(unitPrice(549, 'l')).toBe('$5.49/L');
    expect(unitPrice(399, 'un')).toBe('$3.99');
  });

  it('mirrors the API when an item changes status', () => {
    const milk = item({ quantity_needed: 4 });
    expect(applyItemChanges(milk, { status: 'checked' }).quantity_bought).toBe(4);
    expect(applyItemChanges(milk, { status: 'checked', quantity_bought: 3 }).quantity_bought).toBe(
      3,
    );
    const checked = applyItemChanges(milk, { status: 'checked' });
    expect(applyItemChanges(checked, { status: 'not_found' }).quantity_bought).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import type { ShoppingList } from '../api/types';
import { detectLanguage } from '../i18n';
import { makeProduct } from '../test/factories';
import { formatQuantity, splitMoney } from './format';
import { areaStats, listStats, runningLow } from './stats';

describe('formatQuantity', () => {
  it('adds the unit label, except for countable items', () => {
    expect(formatQuantity(2, 'l')).toBe('2 L');
    expect(formatQuantity(0.5, 'kg')).toBe('0.5 kg');
    expect(formatQuantity(12, 'un')).toBe('12');
  });

  it('uses the locale decimal separator', () => {
    expect(formatQuantity(0.5, 'kg', 'pt-BR')).toBe('0,5 kg');
  });
});

describe('splitMoney', () => {
  it('separates the cents so they can be drawn lighter', () => {
    expect(splitMoney(6180)).toEqual(['$61', '.80']);
  });
});

describe('detectLanguage', () => {
  it('uses Portuguese for any pt locale and English otherwise', () => {
    expect(detectLanguage(['pt-BR', 'en'])).toBe('pt-BR');
    expect(detectLanguage(['fr-CA', 'en-CA'])).toBe('en');
  });
});

describe('areaStats', () => {
  it('averages how full each product is and counts the low ones', () => {
    const stats = areaStats([
      makeProduct({ current_quantity: 6, ideal_quantity: 6 }),
      makeProduct({ current_quantity: 2, ideal_quantity: 4, needs_restock: true }),
    ]);

    expect(stats).toEqual({ count: 2, low: 1, percent: 75 });
  });

  it('caps a product above its ideal at 100%', () => {
    expect(areaStats([makeProduct({ current_quantity: 9, ideal_quantity: 6 })]).percent).toBe(100);
  });
});

describe('listStats', () => {
  it('counts empty products and estimates the cost from last prices', () => {
    const milk = makeProduct({ current_quantity: 0 });
    const rice = makeProduct({ current_quantity: 3 });
    const list: ShoppingList = {
      id: 'list-1',
      status: 'open',
      market_id: null,
      sorted_by_market_id: null,
      item_count: 2,
      groups: [
        {
          corridor_id: null,
          name: 'Dairy',
          items: [
            { ...item(milk.id), quantity_needed: 4, last_price_cents: 549 },
            { ...item(rice.id), quantity_needed: 5, last_price_cents: null },
          ],
        },
      ],
    };

    expect(listStats(list, [milk, rice])).toEqual({
      items: 2,
      empty: 1,
      atMinimum: 1,
      estimatedCents: 2196,
    });
  });
});

describe('runningLow', () => {
  it('lists products at their minimum, emptiest first', () => {
    const half = makeProduct({ name: 'Rice', current_quantity: 3, needs_restock: true });
    const empty = makeProduct({ name: 'Butter', current_quantity: 0, needs_restock: true });
    const fine = makeProduct({ name: 'Salt' });

    expect(runningLow([half, fine, empty]).map((product) => product.name)).toEqual([
      'Butter',
      'Rice',
    ]);
  });
});

function item(productId: string) {
  return {
    id: `item-${productId}`,
    product_id: productId,
    name: productId,
    brand: null,
    category: 'Dairy',
    unit: 'un' as const,
    quantity_needed: 1,
    quantity_bought: null,
    status: 'pending' as const,
    added_manually: false,
    assigned_user_id: null,
    last_price_cents: null,
    current_quantity: 0,
    min_quantity: 1,
    ideal_quantity: 4,
  };
}

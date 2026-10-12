import type { Product } from '../api/types';

let next = 0;

export function makeProduct(overrides: Partial<Product> = {}): Product {
  next += 1;
  return {
    id: `product-${next}`,
    name: `Product ${next}`,
    brand: null,
    category_id: 'category-1',
    storage_area_id: 'area-1',
    unit: 'un',
    consume_step: 1,
    ideal_quantity: 6,
    min_quantity: 2,
    current_quantity: 6,
    below_ideal: false,
    needs_restock: false,
    last_price_cents: null,
    last_purchased_at: null,
    archived_at: null,
    ...overrides,
  };
}

import type { Product, ShoppingList } from '../api/types';
import type { Stock } from './health';

export interface AreaStats {
  count: number;
  low: number;
  /** Average of how full each product is, relative to its ideal (0-100). */
  percent: number;
}

/** The product's stock in the shape the health helpers use. */
export function stockOf(
  product: Pick<Product, 'current_quantity' | 'min_quantity' | 'ideal_quantity'>,
): Stock {
  return {
    current: product.current_quantity,
    min: product.min_quantity,
    ideal: product.ideal_quantity,
  };
}

export function stockRatio(product: Product): number {
  if (product.ideal_quantity <= 0) return 1;
  return Math.min(product.current_quantity / product.ideal_quantity, 1);
}

export function areaStats(products: Product[]): AreaStats {
  if (products.length === 0) return { count: 0, low: 0, percent: 100 };
  const total = products.reduce((sum, product) => sum + stockRatio(product), 0);
  return {
    count: products.length,
    low: products.filter((product) => product.needs_restock).length,
    percent: Math.round((total / products.length) * 100),
  };
}

export interface ListStats {
  items: number;
  empty: number;
  atMinimum: number;
  /** Sum of quantity x last price of the items that have a price. */
  estimatedCents: number;
}

export function listStats(list: ShoppingList | undefined, products: Product[]): ListStats {
  const items = list?.groups.flatMap((group) => group.items) ?? [];
  const stockById = new Map(products.map((product) => [product.id, product.current_quantity]));
  const empty = items.filter((item) => (stockById.get(item.product_id) ?? 0) <= 0).length;
  const estimatedCents = items.reduce(
    (sum, item) =>
      item.last_price_cents === null
        ? sum
        : sum + Math.round(item.quantity_needed * item.last_price_cents),
    0,
  );
  return { items: items.length, empty, atMinimum: items.length - empty, estimatedCents };
}

/** Products that reached their minimum, emptiest first. */
export function runningLow(products: Product[], limit = 5): Product[] {
  return products
    .filter((product) => product.needs_restock)
    .sort((a, b) => stockRatio(a) - stockRatio(b) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

import type { Product, ProductUnit, ShoppingList, ShoppingListItem } from '../api/types';
import { formatQuantity, splitMoney } from './format';

/** Rounds away float noise: 0.1 + 0.2 -> 0.3. */
export function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function listItems(list: ShoppingList | undefined): ShoppingListItem[] {
  return list?.groups.flatMap((group) => group.items) ?? [];
}

export interface ListSection {
  key: string;
  /** "1 · Produce" when sorted by a market's corridors, else the category name. */
  title: string;
  items: ShoppingListItem[];
}

/**
 * Groups ready to show. Corridors are numbered in walking order from the full list, so
 * "3 · Grains" keeps its number when only one person's route is shown.
 */
export function listSections(
  list: ShoppingList | undefined,
  options: { onlyUserId?: string | null; otherLabel: string },
): ListSection[] {
  if (!list) return [];
  const byMarket = list.sorted_by_market_id !== null;
  let corridor = 0;
  return list.groups
    .map((group) => {
      const isCorridor = byMarket && group.corridor_id !== null;
      if (isCorridor) corridor += 1;
      const name = group.corridor_id === null && byMarket ? options.otherLabel : group.name;
      return {
        key: group.corridor_id ?? `group-${group.name}`,
        title: isCorridor ? `${corridor} · ${name}` : name,
        items: options.onlyUserId
          ? group.items.filter((item) => item.assigned_user_id === options.onlyUserId)
          : group.items,
      };
    })
    .filter((section) => section.items.length > 0);
}

/** True once the route was split: someone has items assigned. */
export function isSplit(list: ShoppingList | undefined): boolean {
  return listItems(list).some((item) => item.assigned_user_id !== null);
}

export interface CartStats {
  total: number;
  checked: number;
  notFound: number;
  pending: number;
  /** Quantity bought x last price of the checked items that have a price. */
  cartCents: number;
  /** Checked items without a known price, so the total is an estimate. */
  unpriced: number;
}

export function cartStats(items: ShoppingListItem[]): CartStats {
  const checked = items.filter((item) => item.status === 'checked');
  return {
    total: items.length,
    checked: checked.length,
    notFound: items.filter((item) => item.status === 'not_found').length,
    pending: items.filter((item) => item.status === 'pending').length,
    cartCents: checked.reduce(
      (sum, item) =>
        item.last_price_cents === null
          ? sum
          : sum +
            Math.round((item.quantity_bought ?? item.quantity_needed) * item.last_price_cents),
      0,
    ),
    unpriced: checked.filter((item) => item.last_price_cents === null).length,
  };
}

/** Price per unit of the product: "$5.49/L", "$3.99" for items counted in units. */
export function unitPrice(cents: number, unit: ProductUnit, locale = 'en'): string {
  const money = splitMoney(cents, locale).join('');
  const label = formatQuantity(1, unit, locale).replace(/^1\s?/, '');
  return label ? `${money}/${label}` : money;
}

/** How much to add by hand: what fills the product up to its ideal, at least one step. */
export function suggestedQuantity(product: Product): number {
  const step = product.consume_step > 0 ? product.consume_step : 1;
  const missing = product.ideal_quantity - product.current_quantity;
  const steps = Math.max(1, Math.ceil(roundQuantity(missing / step)));
  return roundQuantity(steps * step);
}

/** Step used by the +/- buttons of an item: the product's consume step, else 1. */
export function stepOf(productId: string, products: Product[]): number {
  const step = products.find((product) => product.id === productId)?.consume_step;
  return step && step > 0 ? step : 1;
}

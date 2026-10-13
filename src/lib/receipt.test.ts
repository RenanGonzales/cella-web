import { describe, expect, it } from 'vitest';

import type { ReceiptDraft } from '../api/types';
import { checkReview, confirmBody, parseCents, priceChange, reviewLines } from './receipt';
import { summarizeSpending } from './spending';
import { overIdeal } from './health';

const draft: ReceiptDraft = {
  source: 'sample',
  store_name: 'MARKET',
  purchased_on: '2026-10-12',
  total_cents: 1113,
  lines: [
    {
      text: 'MILK',
      quantity: 2,
      unit_price_cents: 549,
      line_total_cents: 1098,
      product_id: 'milk',
      previous_price_cents: 499,
    },
    {
      text: 'BAG',
      quantity: 1,
      unit_price_cents: 15,
      line_total_cents: 15,
      product_id: null,
      previous_price_cents: null,
    },
  ],
};

describe('receipt review', () => {
  it('reads prices typed with a comma or a dot', () => {
    expect(parseCents('5,49')).toBe(549);
    expect(parseCents(' 12.5 ')).toBe(1250);
    expect(parseCents('7')).toBe(700);
    expect(parseCents('5.499')).toBeNull();
    expect(parseCents('abc')).toBeNull();
    expect(parseCents('')).toBeNull();
  });

  it('shows how the price moved since the last purchase', () => {
    expect(priceChange(499, 549)).toBe(10);
    expect(priceChange(549, 499)).toBe(-9);
    expect(priceChange(null, 549)).toBeNull();
    expect(priceChange(0, 549)).toBeNull();
  });

  it('sends one price per product line and the total', () => {
    const lines = reviewLines(draft);
    expect(lines[0]).toMatchObject({ price: '5.49', productId: 'milk', previousCents: 499 });
    expect(confirmBody(draft, lines, 1113)).toEqual({
      source: 'sample',
      total_cents: 1113,
      prices: [{ product_id: 'milk', unit_price_cents: 549 }],
    });
  });

  it('flags products bought without a line, repeated products and bad prices', () => {
    const lines = reviewLines(draft);
    expect(checkReview(lines, ['milk', 'eggs'])).toMatchObject({
      missing: ['eggs'],
      repeated: [],
      invalid: [],
      linesCents: 1113,
    });
    const twice = lines.map((line) => ({
      ...line,
      productId: 'milk',
      price: line.key ? 'x' : line.price,
    }));
    const check = checkReview(twice, ['milk']);
    expect(check.repeated).toEqual(['milk']);
    expect(check.invalid).toEqual([1]);
  });
});

describe('spending and stock figures', () => {
  it('compares this month with the last one', () => {
    const summary = summarizeSpending([
      { month: '2026-08', paid_cents: 30000, purchases: 4 },
      { month: '2026-09', paid_cents: 40000, purchases: 4 },
      { month: '2026-10', paid_cents: 30000, purchases: 3 },
    ]);
    expect(summary.change).toBe(-25);
    expect(summary.peak).toBe(40000);
    expect(
      summarizeSpending([{ month: '2026-10', paid_cents: 100, purchases: 1 }]).change,
    ).toBeNull();
  });

  it('tells how much is above the ideal', () => {
    expect(overIdeal({ current: 32, min: 6, ideal: 12 })).toBe(20);
    expect(overIdeal({ current: 12, min: 6, ideal: 12 })).toBe(0);
    expect(overIdeal({ current: 0.7, min: 0.1, ideal: 0.4 })).toBe(0.3);
    expect(overIdeal({ current: 3, min: 0, ideal: 0 })).toBe(0);
  });
});

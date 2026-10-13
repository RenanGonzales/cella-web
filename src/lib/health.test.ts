import { describe, expect, it } from 'vitest';

import { HEALTH_TONES, fillRatio, healthOf, minimumMark } from './health';

describe('stock health', () => {
  it('goes from full to out as the stock drops past the ideal and the minimum', () => {
    const at = (current: number) => healthOf({ current, min: 3, ideal: 6 });
    expect([at(7), at(6), at(5), at(3), at(1), at(0)]).toEqual([
      'full',
      'full',
      'good',
      'low',
      'low',
      'out',
    ]);
  });

  it('uses deeper blues for healthier stock', () => {
    const lightness = (hex: string) =>
      parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16);
    const order = (['full', 'good', 'low', 'out'] as const).map((h) =>
      lightness(HEALTH_TONES[h].fill),
    );
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('marks the minimum on the bar only when there is one to show', () => {
    expect(minimumMark({ current: 1, min: 3, ideal: 12 })).toBe(0.25);
    expect(minimumMark({ current: 1, min: 0, ideal: 1 })).toBeNull();
    expect(fillRatio({ current: 9, min: 3, ideal: 6 })).toBe(1);
  });
});

/**
 * Stock "health" of a product, from its minimum and ideal:
 * - full: at or above the ideal;
 * - good: above the minimum (not on the list yet);
 * - low: at or below the minimum (on the list);
 * - out: nothing left.
 * Drawn in blue tones: the deeper the blue, the healthier the stock.
 */
export type Health = 'full' | 'good' | 'low' | 'out';

export interface Stock {
  current: number;
  min: number;
  ideal: number;
}

export function healthOf({ current, min, ideal }: Stock): Health {
  if (current <= 0) return 'out';
  if (current >= ideal) return 'full';
  if (current <= min) return 'low';
  return 'good';
}

/** Deep navy (full) to pale ice (out); text colors keep 4.5:1 contrast on each fill. */
export const HEALTH_TONES: Record<Health, { fill: string; text: string }> = {
  full: { fill: '#0B2545', text: '#FFFFFF' },
  good: { fill: '#2F6690', text: '#FFFFFF' },
  low: { fill: '#8DA9C4', text: '#0B2545' },
  out: { fill: '#C9D9EA', text: '#0B2545' },
};

/** 0..1, how far the stock is towards the ideal. */
export function fillRatio({ current, ideal }: Stock): number {
  if (ideal <= 0) return 1;
  return Math.max(0, Math.min(current / ideal, 1));
}

/** Where the minimum sits on the bar (0..1), or null when there is no minimum to show. */
export function minimumMark({ min, ideal }: Stock): number | null {
  if (min <= 0 || ideal <= 0 || min >= ideal) return null;
  return min / ideal;
}

/** How much is above the ideal (0 when not over). Rounded to avoid 0.30000000000000004. */
export function overIdeal({ current, ideal }: Stock): number {
  const over = current - ideal;
  return ideal > 0 && over > 0 ? Math.round(over * 1000) / 1000 : 0;
}

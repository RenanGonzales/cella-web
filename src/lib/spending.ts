import type { MonthSpending } from '../api/types';

/** "2026-10" -> a Date in that month (UTC), for month names. */
export function monthDate(month: string): Date {
  const [year = 1970, number = 1] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1, 15));
}

export function monthName(month: string, locale: string, style: 'long' | 'short' = 'long') {
  return new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' }).format(
    monthDate(month),
  );
}

export interface SpendingSummary {
  current: MonthSpending | null;
  previous: MonthSpending | null;
  /** Whole percent against the previous month (+12, -8), or null without a base. */
  change: number | null;
  peak: number;
}

export function summarizeSpending(months: MonthSpending[]): SpendingSummary {
  const current = months.at(-1) ?? null;
  const previous = months.at(-2) ?? null;
  const change =
    current && previous && previous.paid_cents > 0
      ? Math.round(((current.paid_cents - previous.paid_cents) / previous.paid_cents) * 100)
      : null;
  return {
    current,
    previous,
    change,
    peak: Math.max(0, ...months.map((month) => month.paid_cents)),
  };
}

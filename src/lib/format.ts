import type { ProductUnit } from '../api/types';

const UNIT_LABELS: Record<ProductUnit, string> = { un: '', kg: 'kg', g: 'g', l: 'L', ml: 'ml' };

/** 2 + "l" -> "2 L"; 0.5 + "kg" -> "0.5 kg"; 12 + "un" -> "12". */
export function formatQuantity(value: number, unit: ProductUnit, locale = 'en'): string {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value);
  const label = UNIT_LABELS[unit];
  return label ? `${number} ${label}` : number;
}

/**
 * Money split in two parts, so the cents can be drawn lighter: 6180 -> ["$61", ".80"].
 * The demo shows dollars; a real household would choose its currency.
 */
export function splitMoney(cents: number, locale = 'en', currency = 'USD'): [string, string] {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(
    cents / 100,
  );
  const decimalIndex = parts.findIndex((part) => part.type === 'decimal');
  if (decimalIndex === -1) return [parts.map((part) => part.value).join(''), ''];
  const head = parts
    .slice(0, decimalIndex)
    .map((part) => part.value)
    .join('');
  const tail = parts
    .slice(decimalIndex)
    .map((part) => part.value)
    .join('');
  return [head, tail];
}

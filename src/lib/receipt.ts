import type { ReceiptConfirm, ReceiptDraft } from '../api/types';

/** The largest side the model reads without shrinking it first (Claude vision). */
export const RECEIPT_MAX_SIDE = 1568;
const JPEG_QUALITY = 0.85;

/** One line of the receipt while it is reviewed. */
export interface ReviewLine {
  key: number;
  text: string;
  quantity: number | null;
  productId: string | null;
  /** What the person sees and edits, "5.49" or "5,49". */
  price: string;
  previousCents: number | null;
}

export function reviewLines(draft: ReceiptDraft): ReviewLine[] {
  return draft.lines.map((line, key) => ({
    key,
    text: line.text,
    quantity: line.quantity,
    productId: line.product_id,
    price: line.unit_price_cents === null ? '' : centsToText(line.unit_price_cents),
    previousCents: line.previous_price_cents,
  }));
}

export function centsToText(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** "5,49", "5.49" or "5" -> 549; anything else -> null. */
export function parseCents(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** Price move against the last purchase, in whole percent (+3, -5), or null. */
export function priceChange(previousCents: number | null, cents: number | null): number | null {
  if (previousCents === null || cents === null || previousCents <= 0) return null;
  return Math.round(((cents - previousCents) / previousCents) * 100);
}

export interface ReviewCheck {
  /** Products bought on the trip that no line gives a price to. */
  missing: string[];
  /** Products picked on more than one line. */
  repeated: string[];
  /** Lines with a product but no valid price. */
  invalid: number[];
  linesCents: number;
}

export function checkReview(lines: ReviewLine[], boughtIds: string[]): ReviewCheck {
  const seen = new Map<string, number>();
  const invalid: number[] = [];
  let linesCents = 0;
  for (const line of lines) {
    const cents = parseCents(line.price);
    if (line.productId) {
      seen.set(line.productId, (seen.get(line.productId) ?? 0) + 1);
      if (cents === null) invalid.push(line.key);
    }
    if (cents !== null) linesCents += Math.round(cents * (line.quantity ?? 1));
  }
  return {
    missing: boughtIds.filter((id) => !seen.has(id)),
    repeated: [...seen].filter(([, count]) => count > 1).map(([id]) => id),
    invalid,
    linesCents,
  };
}

export function confirmBody(
  draft: ReceiptDraft,
  lines: ReviewLine[],
  totalCents: number | null,
): ReceiptConfirm {
  const prices = lines.flatMap((line) => {
    const cents = parseCents(line.price);
    return line.productId && cents !== null
      ? [{ product_id: line.productId, unit_price_cents: cents }]
      : [];
  });
  return { source: draft.source, total_cents: totalCents, prices };
}

/** Shrink a photo to the size the model reads and encode it as JPEG base64. */
export async function photoToUpload(file: Blob): Promise<{ media_type: string; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, RECEIPT_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return { media_type: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) };
}

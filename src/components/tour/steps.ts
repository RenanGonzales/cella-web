/**
 * The guided tour, in order. Each step lights up one spot of the screen (`targets` are
 * `data-tour` names; the last one present wins, so a step can follow a menu into a dialog)
 * and moves on with "Next", a tap on the spot, or an event reported by the app.
 */
export interface TourStep {
  id: string;
  targets: string[];
  advance: 'next' | 'click' | 'event';
  event?: 'consumed' | 'started' | 'split' | 'checkout' | 'receipt';
}

const STEPS: TourStep[] = [
  { id: 'list-card', targets: ['home-list'], advance: 'next' },
  { id: 'fridge', targets: ['area-Fridge'], advance: 'click' },
  { id: 'use', targets: ['use-Whole milk'], advance: 'event', event: 'consumed' },
  { id: 'to-list', targets: ['nav-/list'], advance: 'click' },
  { id: 'corridors', targets: ['list-first-section'], advance: 'next' },
  {
    id: 'start',
    targets: ['start-shopping', 'start-confirm'],
    advance: 'event',
    event: 'started',
  },
  { id: 'check', targets: ['store-item'], advance: 'click' },
  {
    id: 'split',
    targets: ['store-menu', 'menu-split', 'split-confirm'],
    advance: 'event',
    event: 'split',
  },
  { id: 'two-phones', targets: [], advance: 'next' },
  { id: 'everyone', targets: ['tab-everyone'], advance: 'click' },
  { id: 'sam', targets: ['list-sections'], advance: 'next' },
  {
    id: 'finish',
    targets: ['finish-shopping', 'checkout-confirm'],
    advance: 'event',
    event: 'checkout',
  },
  { id: 'receipt', targets: ['add-receipt'], advance: 'click' },
  { id: 'receipt-review', targets: ['receipt-save'], advance: 'event', event: 'receipt' },
  { id: 'end', targets: [], advance: 'next' },
];

/** The two-phone page only exists on large screens. */
export function tourSteps(wide: boolean): TourStep[] {
  return wide ? STEPS : STEPS.filter((step) => step.id !== 'two-phones');
}

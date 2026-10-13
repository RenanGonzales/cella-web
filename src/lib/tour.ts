import { useEffect, useState } from 'react';

/**
 * Guided tour state, kept in localStorage so it survives the jump to the two-phone page
 * (where the tour continues inside Alex's frame) and stays in sync across frames.
 */
export interface TourState {
  step: string;
  /** Started on a large screen: includes the two-phone page. */
  wide: boolean;
}

const KEY = 'cella.tour';
const CHANGE = 'cella:tour-state';
const EVENT = 'cella:tour-event';

export function readTour(): TourState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TourState) : null;
  } catch {
    return null;
  }
}

function writeTour(state: TourState | null): void {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    // Without storage the tour still runs in this page; it just cannot be resumed.
  }
  window.dispatchEvent(new CustomEvent(CHANGE, { detail: state }));
}

/** Large enough to show two phones side by side (and not already inside a frame). */
export function canShowTwoPhones(): boolean {
  return window.innerWidth >= 1100 && window.self === window.top;
}

export function startTour(): void {
  writeTour({ step: 'list-card', wide: canShowTwoPhones() });
}

export function goToStep(step: string): void {
  const current = readTour();
  writeTour({ step, wide: current?.wide ?? false });
}

export function stopTour(): void {
  writeTour(null);
}

export function useTourState(): TourState | null {
  const [state, setState] = useState(readTour);
  useEffect(() => {
    const local = (event: Event) => setState((event as CustomEvent<TourState | null>).detail);
    // Other frames (and tabs) change it through storage events.
    const other = (event: StorageEvent) => event.key === KEY && setState(readTour());
    window.addEventListener(CHANGE, local);
    window.addEventListener('storage', other);
    return () => {
      window.removeEventListener(CHANGE, local);
      window.removeEventListener('storage', other);
    };
  }, []);
  return state;
}

/** Things the app reports so the tour can move on: "consumed", "started", "split"... */
export type TourEvent = 'consumed' | 'started' | 'split' | 'checkout';

export function emitTourEvent(name: TourEvent): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: name }));
}

export function onTourEvent(handler: (name: TourEvent) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<TourEvent>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

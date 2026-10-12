const INTRO_SEEN_KEY = 'cella.introSeen';

/** The demo opening plays once per browser. */
export function introSeen(): boolean {
  try {
    return localStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    // Shown again next time: harmless.
  }
}

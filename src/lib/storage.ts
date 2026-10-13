import { useCallback, useState } from 'react';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** A string remembered in this browser (best effort: storage may be blocked). */
export function useStoredString(key: string): [string | null, (value: string) => void] {
  const [value, setValue] = useState(() => read(key));
  const update = useCallback(
    (next: string) => {
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // Not remembered: fine.
      }
    },
    [key],
  );
  return [value, update];
}

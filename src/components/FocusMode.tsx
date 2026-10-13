import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface FocusState {
  focused: boolean;
  setFocused: (focused: boolean) => void;
}

const FocusContext = createContext<FocusState>({ focused: false, setFocused: () => {} });

/**
 * Focus mode hides the phone's bottom navigation, e.g. in the store, where the screen
 * belongs to the list and its "Finish shopping" button.
 */
export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [focused, setFocused] = useState(false);
  return <FocusContext.Provider value={{ focused, setFocused }}>{children}</FocusContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFocused(): boolean {
  return useContext(FocusContext).focused;
}

/** Turns focus mode on while `active` and the calling screen is mounted. */
// eslint-disable-next-line react-refresh/only-export-components
export function useFocusMode(active: boolean): void {
  const { setFocused } = useContext(FocusContext);
  useEffect(() => {
    setFocused(active);
    return () => setFocused(false);
  }, [active, setFocused]);
}

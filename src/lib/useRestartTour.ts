import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { partnerStore, persona } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { startTour } from './tour';

/**
 * "Take the tour" from inside the demo: a fresh demo household (so every step finds what
 * it expects, e.g. milk not yet consumed), then the tour from the first step.
 * Null outside the demo, or in Sam's frame.
 */
export function useRestartTour(): { restart: () => void; busy: boolean } | null {
  const { loginDemo } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (persona !== 'main' || window.self !== window.top || partnerStore.get() === null) return null;
  return {
    busy,
    restart: () => {
      setBusy(true);
      loginDemo()
        .then(() => {
          startTour();
          navigate('/');
        })
        .catch(() => undefined)
        .finally(() => setBusy(false));
    },
  };
}

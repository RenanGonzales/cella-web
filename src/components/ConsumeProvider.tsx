import { Button, Snackbar } from '@mui/material';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { useConsume, useUndo } from '../api/hooks';
import type { Product } from '../api/types';
import { formatQuantity } from '../lib/format';
import { emitTourEvent } from '../lib/tour';

type Feedback =
  { kind: 'done'; message: string; eventId: string } | { kind: 'info'; message: string };

const ConsumeContext = createContext<((product: Product) => void) | null>(null);

/** Seconds the "Undo" stays on screen (the API accepts undo for 10 minutes). */
const UNDO_VISIBLE_MS = 6000;

/** One tap to consume, with the "· Undo" snackbar shared by every screen. */
export function ConsumeProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const consumeMutation = useConsume();
  const undoMutation = useUndo();
  const [shown, setShown] = useState<{ feedback: Feedback; path: string } | null>(null);
  const { pathname } = useLocation();
  // "Undo" belongs to the screen where the item was used: leaving it hides the message.
  const feedback = shown?.path === pathname ? shown.feedback : null;
  const setFeedback = useCallback(
    (next: Feedback | null) => setShown(next ? { feedback: next, path: pathname } : null),
    [pathname],
  );

  const consume = useCallback(
    (product: Product) => {
      consumeMutation.mutate(product, {
        onSuccess: (data) => {
          const name = data.product.name;
          if (data.consumption_event_id === null) {
            setFeedback({ kind: 'info', message: t('consume.nothingLeft', { name }) });
            return;
          }
          const left = formatQuantity(
            data.product.current_quantity,
            data.product.unit,
            i18n.language,
          );
          emitTourEvent('consumed');
          setFeedback({
            kind: 'done',
            message: t('consume.done', { name, left }),
            eventId: data.consumption_event_id,
          });
        },
        onError: () => setFeedback({ kind: 'info', message: t('consume.failed') }),
      });
    },
    [consumeMutation, i18n.language, setFeedback, t],
  );

  const undo = (eventId: string) => {
    undoMutation.mutate(eventId, {
      onSuccess: () => setFeedback({ kind: 'info', message: t('consume.undone') }),
      onError: () => setFeedback({ kind: 'info', message: t('consume.failed') }),
    });
  };

  const value = useMemo(() => consume, [consume]);

  return (
    <ConsumeContext.Provider value={value}>
      {children}
      <Snackbar
        key={feedback && 'eventId' in feedback ? feedback.eventId : feedback?.message}
        open={feedback !== null}
        autoHideDuration={UNDO_VISIBLE_MS}
        onClose={(_, reason) => reason !== 'clickaway' && setFeedback(null)}
        message={feedback?.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 104, md: 32 } }}
        action={
          feedback?.kind === 'done' ? (
            <Button
              size="small"
              onClick={() => undo(feedback.eventId)}
              sx={{ color: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.16)', minHeight: 36 }}
            >
              {t('consume.undo')}
            </Button>
          ) : undefined
        }
      />
    </ConsumeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConsumeAction(): (product: Product) => void {
  const consume = useContext(ConsumeContext);
  if (!consume) throw new Error('useConsumeAction must be used inside ConsumeProvider');
  return consume;
}

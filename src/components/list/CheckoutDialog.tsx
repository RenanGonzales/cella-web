import { Box, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

import type { CheckoutResponse, PurchaseDetail } from '../../api/types';
import { splitMoney } from '../../lib/format';
import type { CartStats } from '../../lib/shopping';
import { palette } from '../../theme';
import { BigNumber, Icon, Money } from '../ui';
import { Sheet } from './Sheet';

/** Confirm the end of the purchase, then show what happened to stock and the list. */
export function CheckoutDialog({
  stats,
  result,
  busy,
  onClose,
  onConfirm,
  onDone,
  onReceipt,
  receipt = null,
}: {
  /** The cart when "Finish" was tapped (the list itself changes right after). */
  stats: CartStats;
  result: CheckoutResponse | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onDone: () => void;
  /** Opens the receipt review for this purchase. */
  onReceipt?: () => void;
  /** The purchase once its receipt is saved: the total comes from it. */
  receipt?: PurchaseDetail | null;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  if (result) {
    return (
      <Sheet
        open
        onClose={onDone}
        title={t('list.doneTitle')}
        actions={
          <Button variant="contained" onClick={onDone}>
            {t('list.backHome')}
          </Button>
        }
      >
        {receipt ? (
          <Box>
            <BigNumber value={<Money parts={splitMoney(receipt.paid_cents, locale)} />} size={56} />
            <Box sx={{ mt: 1, fontSize: 13, color: palette.textMuted }}>
              {t('receipt.savedNote')}
            </Box>
          </Box>
        ) : result.items_without_price === 0 ? (
          <BigNumber value={<Money parts={splitMoney(result.total_cents, locale)} />} size={56} />
        ) : (
          // Prices of this purchase come later; meanwhile, estimate from the last ones.
          <Box>
            <BigNumber
              value={
                <>
                  ~<Money parts={splitMoney(stats.cartCents, locale)} />
                </>
              }
              size={56}
            />
            <Box sx={{ mt: 1, fontSize: 13, color: palette.textMuted }}>
              {t('list.estimatedFromLast')}
            </Box>
          </Box>
        )}
        <Box component="ul" sx={{ m: 0, pl: 2.5, color: palette.textSoft, lineHeight: 1.8 }}>
          <li>{t('list.stockUp', { count: result.items_bought })}</li>
          {result.items_carried_over > 0 && (
            <li>{t('list.carried', { count: result.items_carried_over })}</li>
          )}
        </Box>
        {onReceipt && !receipt && result.items_bought > 0 && (
          <Button
            variant="outlined"
            onClick={onReceipt}
            startIcon={<Icon name="receipt" size={20} />}
            data-tour="add-receipt"
            sx={{ alignSelf: 'flex-start' }}
          >
            {t('receipt.add')}
          </Button>
        )}
      </Sheet>
    );
  }

  const leftOver = stats.notFound + stats.pending;
  return (
    <Sheet
      open
      onClose={onClose}
      title={t('list.checkoutTitle')}
      actions={
        <>
          <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
            {t('list.keepShopping')}
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={onConfirm}
            data-tour="checkout-confirm"
          >
            {t('list.finishConfirm')}
          </Button>
        </>
      }
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
        <Figure label={t('list.inCart')} value={stats.checked} />
        <Figure label={t('list.notFound')} value={stats.notFound} />
        <Figure label={t('list.toPick')} value={stats.pending} />
      </Box>
      <Box
        sx={{
          color: palette.textSoft,
          fontSize: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
        }}
      >
        <span>
          {t('list.estimatedCart')} <Money parts={splitMoney(stats.cartCents, locale)} />
        </span>
        {leftOver > 0 && <span>{t('list.movesNext', { count: leftOver })}</span>}
        {stats.checked === 0 && <span>{t('list.cartEmpty')}</span>}
      </Box>
    </Sheet>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: '18px', bgcolor: palette.canvas }}>
      <Box sx={{ fontSize: 12, color: palette.textMuted }}>{label}</Box>
      <Box sx={{ fontSize: 28, letterSpacing: '-0.03em' }}>{value}</Box>
    </Box>
  );
}

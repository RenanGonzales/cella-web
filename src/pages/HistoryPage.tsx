import { Box, Button, ButtonBase, Skeleton } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMe, usePurchase, usePurchases } from '../api/hooks';
import type { PurchaseSummary } from '../api/types';
import { SpendingCard } from '../components/history/SpendingCard';
import { Sheet } from '../components/list/Sheet';
import { ReceiptDialog } from '../components/receipt/ReceiptDialog';
import { Icon, Money } from '../components/ui';
import { formatMoney, formatQuantity, splitMoney } from '../lib/format';
import { monthName } from '../lib/spending';
import { palette } from '../theme';

/** Past purchases by month, with what was paid; each one opens with its items and prices. */
export function HistoryPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { data: purchases, isLoading } = usePurchases();
  const { data: me } = useMe();
  const [openId, setOpenId] = useState<string | null>(null);
  const [receiptFor, setReceiptFor] = useState<string | null>(null);

  const groups = groupByMonth(purchases ?? []);

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box component="header" sx={{ px: { xs: 1, md: 0 }, pt: { xs: 1, md: 0 } }}>
        <Box
          component="h1"
          sx={{ m: 0, fontSize: { xs: 34, md: 40 }, fontWeight: 500, letterSpacing: '-0.03em' }}
        >
          {t('history.title')}
        </Box>
        <Box component="p" sx={{ m: 0, mt: 0.5, color: palette.textMuted }}>
          {t('history.summary', { count: purchases?.length ?? 0 })}
        </Box>
      </Box>

      <SpendingCard />

      {isLoading ? (
        <Skeleton variant="rounded" height={240} sx={{ borderRadius: '30px' }} />
      ) : groups.length === 0 ? (
        <Box
          sx={{ p: 3, borderRadius: '30px', bgcolor: palette.surface, color: palette.textMuted }}
        >
          {t('history.empty')}
        </Box>
      ) : (
        groups.map((group) => (
          <Box
            component="section"
            key={group.month}
            aria-labelledby={`month-${group.month}`}
            sx={{ p: 2.5, pb: 1, borderRadius: '30px', bgcolor: palette.surface }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                mb: 1,
              }}
            >
              <Box
                component="h2"
                id={`month-${group.month}`}
                sx={{ m: 0, fontSize: 15, fontWeight: 500, textTransform: 'capitalize' }}
              >
                {monthName(group.month, locale)} {group.month.slice(0, 4)}
              </Box>
              <Box component="span" sx={{ fontSize: 14, color: palette.textMuted }}>
                {formatMoney(group.paid, locale)}
              </Box>
            </Box>
            {group.purchases.map((purchase) => (
              <PurchaseRow
                key={purchase.id}
                purchase={purchase}
                locale={locale}
                onOpen={() => setOpenId(purchase.id)}
              />
            ))}
          </Box>
        ))
      )}

      {openId && !receiptFor && (
        <PurchaseSheet
          purchaseId={openId}
          onClose={() => setOpenId(null)}
          onReceipt={() => setReceiptFor(openId)}
        />
      )}
      {receiptFor && (
        <ReceiptDialog
          purchaseId={receiptFor}
          canRead={me?.features.receipt_ai ?? false}
          onClose={() => setReceiptFor(null)}
          onSaved={() => setReceiptFor(null)}
        />
      )}
    </Box>
  );
}

interface MonthGroup {
  month: string;
  paid: number;
  purchases: PurchaseSummary[];
}

function groupByMonth(purchases: PurchaseSummary[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const purchase of purchases) {
    const date = new Date(purchase.completed_at);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    let group = groups.at(-1);
    if (!group || group.month !== month) {
      group = { month, paid: 0, purchases: [] };
      groups.push(group);
    }
    group.paid += purchase.paid_cents;
    group.purchases.push(purchase);
  }
  return groups;
}

function PurchaseRow({
  purchase,
  locale,
  onOpen,
}: {
  purchase: PurchaseSummary;
  locale: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const date = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric' }).format(
    new Date(purchase.completed_at),
  );
  const estimated = purchase.receipt_source === null && purchase.items_without_price > 0;
  return (
    <ButtonBase
      onClick={onOpen}
      aria-label={t('history.open', {
        date,
        market: purchase.market_name ?? t('history.noMarket'),
      })}
      sx={{
        width: '100%',
        minHeight: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        textAlign: 'left',
        borderTop: `1px solid ${palette.canvas}`,
        color: palette.navy,
      }}
    >
      <Box sx={{ width: 64, flexShrink: 0, fontSize: 14, color: palette.textMuted }}>{date}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ fontWeight: 500, fontSize: 15 }}>
          {purchase.market_name ?? t('history.noMarket')}
        </Box>
        <Box sx={{ fontSize: 13, color: palette.textMuted }}>
          {t('history.items', { count: purchase.items_bought })}
          {purchase.receipt_source && ` · ${t('history.withReceipt')}`}
        </Box>
      </Box>
      <Box sx={{ fontSize: 17, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
        {estimated ? '~' : ''}
        <Money parts={splitMoney(purchase.paid_cents, locale)} />
      </Box>
    </ButtonBase>
  );
}

function PurchaseSheet({
  purchaseId,
  onClose,
  onReceipt,
}: {
  purchaseId: string;
  onClose: () => void;
  onReceipt: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { data: purchase } = usePurchase(purchaseId);
  const bought = (purchase?.items ?? []).filter((item) => item.status === 'checked');
  const title = purchase
    ? `${purchase.market_name ?? t('history.noMarket')} · ${new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
      }).format(new Date(purchase.completed_at))}`
    : t('history.title');

  return (
    <Sheet
      open
      wide
      onClose={onClose}
      title={title}
      actions={
        <>
          {purchase && (
            <Button
              onClick={onReceipt}
              startIcon={<Icon name="receipt" size={20} />}
              sx={{ mr: 'auto' }}
            >
              {purchase.receipt_source ? t('receipt.again') : t('receipt.add')}
            </Button>
          )}
          <Button variant="contained" onClick={onClose}>
            {t('history.close')}
          </Button>
        </>
      }
    >
      {!purchase ? (
        <Skeleton variant="rounded" height={200} sx={{ borderRadius: '18px' }} />
      ) : (
        <>
          <Box
            component="ul"
            sx={{ m: 0, p: 0, listStyle: 'none', maxHeight: '50vh', overflowY: 'auto' }}
          >
            {bought.map((item) => (
              <Box
                component="li"
                key={item.id}
                sx={{
                  py: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 1,
                  borderTop: `1px solid ${palette.canvas}`,
                  fontSize: 14,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ fontWeight: 500 }}>{item.name}</Box>
                  <Box sx={{ color: palette.textMuted, fontSize: 13 }}>
                    {formatQuantity(item.quantity_bought ?? 0, item.unit, locale)}
                    {item.unit_price_cents !== null &&
                      ` × ${formatMoney(item.unit_price_cents, locale)}`}
                  </Box>
                </Box>
                <Box
                  sx={{
                    whiteSpace: 'nowrap',
                    color: item.line_total_cents === null ? palette.textFaint : undefined,
                  }}
                >
                  {item.line_total_cents === null
                    ? t('history.noPrice')
                    : formatMoney(item.line_total_cents, locale)}
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: 14 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}>
              <span>
                {purchase.receipt_total_cents !== null ? t('history.paid') : t('history.total')}
              </span>
              <span>{formatMoney(purchase.paid_cents, locale)}</span>
            </Box>
            {purchase.receipt_source && (
              <Box sx={{ color: palette.textMuted }}>
                {t(`history.source.${purchase.receipt_source}`)}
              </Box>
            )}
          </Box>
        </>
      )}
    </Sheet>
  );
}

import { Alert, Box, Button, MenuItem, Skeleton, TextField } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePurchase, useReceiptDraft, useSaveReceipt } from '../../api/hooks';
import type { PurchaseDetail, ReceiptDraft } from '../../api/types';
import { formatMoney } from '../../lib/format';
import {
  checkReview,
  confirmBody,
  parseCents,
  photoToUpload,
  priceChange,
  reviewLines,
} from '../../lib/receipt';
import type { ReviewLine } from '../../lib/receipt';
import { palette } from '../../theme';
import { Sheet } from '../list/Sheet';
import { Icon } from '../ui';

const NOT_A_PRODUCT = '';

/**
 * Prices from the receipt of a purchase. The demo (and any account without the reader)
 * goes straight to a sample receipt; accounts with the reader can take a photo, which
 * Claude reads. Either way the lines are reviewed here before anything is saved.
 */
export function ReceiptDialog({
  purchaseId,
  canRead,
  onClose,
  onSaved,
}: {
  purchaseId: string;
  /** Photo reading is on for this account (`features.receipt_ai`). */
  canRead: boolean;
  onClose: () => void;
  onSaved: (detail: PurchaseDetail) => void;
}) {
  const { t } = useTranslation();
  const draft = useReceiptDraft(purchaseId);
  const { mutate: requestDraft } = draft;
  const askedForSample = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Without the reader there is nothing to choose: show the sample right away.
  useEffect(() => {
    if (!canRead && !askedForSample.current) {
      askedForSample.current = true;
      requestDraft(undefined);
    }
  }, [canRead, requestDraft]);

  const readPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      draft.mutate(await photoToUpload(file));
    } catch {
      draft.reset();
    }
  };

  if (draft.data) {
    return (
      <Review purchaseId={purchaseId} draft={draft.data} onClose={onClose} onSaved={onSaved} />
    );
  }

  return (
    <Sheet open onClose={onClose} title={t('receipt.title')} wide>
      {draft.isPending ? (
        <Box aria-busy="true" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ color: palette.textMuted }}>{t('receipt.reading')}</Box>
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} variant="rounded" height={44} sx={{ borderRadius: '14px' }} />
          ))}
        </Box>
      ) : (
        <>
          {draft.isError && <Alert severity="error">{t('receipt.readError')}</Alert>}
          <Box sx={{ color: palette.textSoft }}>{t('receipt.intro')}</Box>
          <Box sx={{ fontSize: 13, color: palette.textMuted }}>{t('receipt.privacy')}</Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {canRead && (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  aria-label={t('receipt.photo')}
                  onChange={(event) => void readPhoto(event.target.files?.[0])}
                />
                <Button
                  variant="contained"
                  startIcon={<Icon name="camera" size={20} />}
                  onClick={() => fileInput.current?.click()}
                >
                  {t('receipt.photo')}
                </Button>
              </>
            )}
            <Button
              variant={canRead ? 'outlined' : 'contained'}
              onClick={() => draft.mutate(undefined)}
            >
              {t('receipt.useSample')}
            </Button>
          </Box>
        </>
      )}
    </Sheet>
  );
}

function Review({
  purchaseId,
  draft,
  onClose,
  onSaved,
}: {
  purchaseId: string;
  draft: ReceiptDraft;
  onClose: () => void;
  onSaved: (detail: PurchaseDetail) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const money = (cents: number) => formatMoney(cents, locale);
  const { data: purchase } = usePurchase(purchaseId);
  const save = useSaveReceipt(purchaseId);
  const [lines, setLines] = useState<ReviewLine[]>(() => reviewLines(draft));

  const bought = (purchase?.items ?? []).filter((item) => item.status === 'checked');
  const nameOf = (id: string) => bought.find((item) => item.product_id === id)?.name ?? '';
  const check = checkReview(
    lines,
    bought.map((item) => item.product_id),
  );
  const total = draft.total_cents ?? check.linesCents;
  const blocked = check.repeated.length > 0 || check.invalid.length > 0 || !purchase;

  const update = (key: number, changes: Partial<ReviewLine>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...changes } : line)),
    );

  const submit = () =>
    save.mutate(confirmBody(draft, lines, total), { onSuccess: (detail) => onSaved(detail) });

  const date = draft.purchased_on
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(`${draft.purchased_on}T00:00:00Z`),
      )
    : null;

  return (
    <Sheet
      open
      wide
      onClose={onClose}
      title={t('receipt.reviewTitle')}
      actions={
        <>
          <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
            {t('receipt.cancel')}
          </Button>
          <Button
            variant="contained"
            disabled={blocked || save.isPending}
            onClick={submit}
            data-tour="receipt-save"
          >
            {t('receipt.save')}
          </Button>
        </>
      }
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {draft.source === 'sample' && (
          <Box
            component="span"
            sx={{
              px: 1.25,
              py: 0.25,
              borderRadius: 999,
              bgcolor: palette.frost,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {t('receipt.sampleBadge')}
          </Box>
        )}
        <Box component="span" sx={{ color: palette.textMuted, fontSize: 14 }}>
          {[draft.store_name, date].filter(Boolean).join(' · ')}
        </Box>
      </Box>
      <Box sx={{ fontSize: 14, color: palette.textSoft }}>
        {draft.source === 'sample' ? t('receipt.sampleHint') : t('receipt.reviewHint')}
      </Box>

      <Box
        component="ul"
        aria-label={t('receipt.lines')}
        data-tour="receipt-lines"
        sx={{
          m: 0,
          p: 0,
          listStyle: 'none',
          maxHeight: { xs: '46vh', sm: '52vh' },
          overflowY: 'auto',
        }}
      >
        {lines.map((line) => {
          const cents = parseCents(line.price);
          const change = line.productId ? priceChange(line.previousCents, cents) : null;
          return (
            <Box
              component="li"
              key={line.key}
              sx={{
                py: 1.25,
                borderTop: `1px solid ${palette.canvas}`,
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: 1,
                alignItems: 'center',
                opacity: line.productId ? 1 : 0.6,
              }}
            >
              <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Box
                  sx={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 13,
                    letterSpacing: '0.02em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {line.quantity !== null && line.quantity !== 1
                    ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(line.quantity)} × `
                    : ''}
                  {line.text}
                </Box>
                <TextField
                  select
                  size="small"
                  value={line.productId ?? NOT_A_PRODUCT}
                  onChange={(event) => update(line.key, { productId: event.target.value || null })}
                  slotProps={{
                    htmlInput: { 'aria-label': t('receipt.productOf', { line: line.text }) },
                  }}
                  error={line.productId !== null && check.repeated.includes(line.productId)}
                  sx={{ maxWidth: 280 }}
                >
                  <MenuItem value={NOT_A_PRODUCT}>{t('receipt.notAProduct')}</MenuItem>
                  {bought.map((item) => (
                    <MenuItem key={item.product_id} value={item.product_id}>
                      {item.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              <Box
                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}
              >
                <TextField
                  size="small"
                  value={line.price}
                  onChange={(event) => update(line.key, { price: event.target.value })}
                  error={line.productId !== null && cents === null}
                  slotProps={{
                    htmlInput: {
                      inputMode: 'decimal',
                      'aria-label': t('receipt.priceOf', { line: line.text }),
                      style: { textAlign: 'right' },
                    },
                  }}
                  sx={{ width: 96 }}
                />
                {change !== null && (
                  <Box
                    component="span"
                    title={
                      line.previousCents !== null
                        ? t('receipt.previous', { price: money(line.previousCents) })
                        : undefined
                    }
                    sx={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: change > 0 ? palette.navyMid : palette.textMuted,
                    }}
                  >
                    {change === 0
                      ? t('receipt.same')
                      : t(change > 0 ? 'receipt.up' : 'receipt.down', {
                          percent: Math.abs(change),
                        })}
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: 14 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}>
          <span>{t('receipt.total')}</span>
          <span>{money(total)}</span>
        </Box>
        {draft.total_cents !== null && Math.abs(draft.total_cents - check.linesCents) > 1 && (
          <Box sx={{ color: palette.textMuted }}>
            {t('receipt.linesDiffer', { lines: money(check.linesCents) })}
          </Box>
        )}
        {check.missing.length > 0 && (
          <Box sx={{ color: palette.textMuted }}>
            {t('receipt.missing', {
              count: check.missing.length,
              names: check.missing.map(nameOf).join(', '),
            })}
          </Box>
        )}
        {check.repeated.length > 0 && (
          <Box role="alert" sx={{ color: palette.navyMid }}>
            {t('receipt.repeated', { names: check.repeated.map(nameOf).join(', ') })}
          </Box>
        )}
        {check.invalid.length > 0 && (
          <Box role="alert" sx={{ color: palette.navyMid }}>
            {t('receipt.invalid')}
          </Box>
        )}
        {save.isError && <Alert severity="error">{t('receipt.saveError')}</Alert>}
      </Box>
      <Box sx={{ fontSize: 12, color: palette.textFaint }}>{t('receipt.updatesPrices')}</Box>
    </Sheet>
  );
}

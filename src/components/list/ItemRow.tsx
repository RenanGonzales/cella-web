import { Box, ButtonBase } from '@mui/material';
import { useTranslation } from 'react-i18next';

import type { Member, ShoppingListItem } from '../../api/types';
import { formatQuantity } from '../../lib/format';
import { unitPrice } from '../../lib/shopping';
import { palette } from '../../theme';

function meta(item: ShoppingListItem, locale: string): string {
  const price =
    item.last_price_cents === null ? null : unitPrice(item.last_price_cents, item.unit, locale);
  return [item.brand, price].filter(Boolean).join(' · ');
}

/** Planning at home: tap the row to change the quantity or remove the item. */
export function PlanRow({ item, onOpen }: { item: ShoppingListItem; onOpen: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  return (
    <ButtonBase
      onClick={onOpen}
      aria-label={t('list.editAria', { name: item.name })}
      sx={{
        width: '100%',
        minHeight: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        textAlign: 'left',
        borderRadius: '14px',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Name>{item.name}</Name>
        <Box component="span" sx={{ fontSize: 12, color: palette.textFaint }}>
          {meta(item, locale) || ' '}
        </Box>
      </Box>
      <Box component="span" sx={{ fontSize: 15 }}>
        {formatQuantity(item.quantity_needed, item.unit, locale)}
      </Box>
    </ButtonBase>
  );
}

/**
 * In the store: tap the circle or the name to put the item in the cart (tap again to
 * take it out); tap the quantity for the other options.
 */
export function StoreRow({
  item,
  owner,
  tourId,
  onToggle,
  onOpen,
}: {
  item: ShoppingListItem;
  tourId?: string;
  /** Shown when the item belongs to someone else's route. */
  owner?: Member;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const done = item.status === 'checked';
  const missing = item.status === 'not_found';
  const quantity = done ? (item.quantity_bought ?? item.quantity_needed) : item.quantity_needed;

  return (
    <Box sx={{ minHeight: 56, display: 'flex', alignItems: 'center', gap: 1 }}>
      <ButtonBase
        role="checkbox"
        aria-checked={done}
        aria-label={item.name}
        data-tour={tourId}
        onClick={onToggle}
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 1.5,
          textAlign: 'left',
          borderRadius: '14px',
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            width: 26,
            height: 26,
            flexShrink: 0,
            borderRadius: '50%',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color .15s ease',
            bgcolor: done ? palette.navy : 'transparent',
            border: done
              ? 'none'
              : `1.5px ${missing ? 'dashed' : 'solid'} ${missing ? palette.steel : '#C5CBD6'}`,
          }}
        >
          {done && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="#FFFFFF"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Name done={done}>{item.name}</Name>
          <Box
            component="span"
            sx={{ fontSize: 12, color: missing ? palette.navyMid : palette.textFaint }}
          >
            {missing ? t('list.notFoundMeta') : meta(item, locale) || ' '}
          </Box>
        </Box>
      </ButtonBase>

      {owner && (
        <Box
          title={owner.name}
          aria-label={t('list.ownerAria', { name: owner.name })}
          sx={{
            width: 24,
            height: 24,
            flexShrink: 0,
            borderRadius: '50%',
            bgcolor: palette.frost,
            color: palette.navy,
            fontSize: 11,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {owner.name[0]}
        </Box>
      )}

      <ButtonBase
        onClick={onOpen}
        aria-label={t('list.optionsAria', { name: item.name })}
        sx={{
          minWidth: 56,
          height: 40,
          px: 1.5,
          borderRadius: 999,
          bgcolor: palette.canvas,
          fontSize: 15,
          color: done ? palette.textFaint : palette.navy,
          whiteSpace: 'nowrap',
        }}
      >
        {formatQuantity(quantity, item.unit, locale)}
      </ButtonBase>
    </Box>
  );
}

function Name({ children, done = false }: { children: string; done?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        fontSize: 15,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: done ? palette.textFaint : palette.navy,
        textDecoration: done ? 'line-through' : 'none',
      }}
    >
      {children}
    </Box>
  );
}

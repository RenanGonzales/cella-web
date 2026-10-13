import { Box, Button, ButtonBase } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ItemChanges, Member, ShoppingListItem } from '../../api/types';
import { palette } from '../../theme';
import { QuantityStepper } from './QuantityStepper';
import { Sheet } from './Sheet';

/** At home: how much to buy, or remove the item. */
export function PlanItemDialog({
  item,
  step,
  onClose,
  onSave,
  onRemove,
}: {
  item: ShoppingListItem;
  step: number;
  onClose: () => void;
  onSave: (changes: ItemChanges) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(item.quantity_needed);
  return (
    <Sheet
      open
      onClose={onClose}
      title={item.name}
      actions={
        <>
          <Button onClick={onRemove} sx={{ mr: 'auto', color: palette.textMuted }}>
            {t('list.remove')}
          </Button>
          <Button
            variant="contained"
            onClick={() =>
              quantity === item.quantity_needed ? onClose() : onSave({ quantity_needed: quantity })
            }
          >
            {t('list.save')}
          </Button>
        </>
      }
    >
      <QuantityStepper
        label={t('list.toBuy')}
        value={quantity}
        step={step}
        unit={item.unit}
        onChange={setQuantity}
      />
    </Sheet>
  );
}

/** In the store: how much went into the cart, not found, and who picks it up. */
export function StoreItemDialog({
  item,
  step,
  members,
  onClose,
  onSave,
}: {
  item: ShoppingListItem;
  step: number;
  members: Member[];
  onClose: () => void;
  onSave: (changes: ItemChanges) => void;
}) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(item.quantity_bought ?? item.quantity_needed);
  const [assignee, setAssignee] = useState(item.assigned_user_id);

  const withAssignee = (changes: ItemChanges): ItemChanges =>
    assignee === item.assigned_user_id ? changes : { ...changes, assigned_user_id: assignee };
  const missing = item.status === 'not_found';

  return (
    <Sheet
      open
      onClose={onClose}
      title={item.name}
      actions={
        <>
          <Button
            onClick={() => onSave(withAssignee({ status: missing ? 'pending' : 'not_found' }))}
            sx={{ mr: 'auto', color: palette.navyMid }}
          >
            {missing ? t('list.foundIt') : t('list.markNotFound')}
          </Button>
          <Button
            variant="contained"
            onClick={() => onSave(withAssignee({ status: 'checked', quantity_bought: quantity }))}
          >
            {t('list.putInCart')}
          </Button>
        </>
      }
    >
      <QuantityStepper
        label={t('list.bought')}
        value={quantity}
        step={step}
        unit={item.unit}
        onChange={setQuantity}
      />
      {members.length > 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ fontSize: 13, color: palette.textMuted }}>{t('list.whoPicks')}</Box>
          <Box role="radiogroup" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {[{ id: null, name: t('list.anyone') }, ...members].map((member) => (
              <Pill
                key={member.id ?? 'anyone'}
                selected={assignee === member.id}
                onClick={() => setAssignee(member.id)}
              >
                {member.name}
              </Pill>
            ))}
          </Box>
        </Box>
      )}
    </Sheet>
  );
}

export function Pill({
  selected,
  onClick,
  children,
  role = 'radio',
  tourId,
}: {
  tourId?: string;
  selected: boolean;
  onClick: () => void;
  children: string;
  role?: 'radio' | 'tab' | 'checkbox';
}) {
  const state = role === 'tab' ? { 'aria-selected': selected } : { 'aria-checked': selected };
  return (
    <ButtonBase
      role={role}
      data-tour={tourId}
      {...state}
      onClick={onClick}
      sx={{
        height: 40,
        px: 2.25,
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 500,
        bgcolor: selected ? palette.navy : palette.canvas,
        color: selected ? '#FFFFFF' : palette.textMuted,
        transition: 'background-color .15s ease',
      }}
    >
      {children}
    </ButtonBase>
  );
}

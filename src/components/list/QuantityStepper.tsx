import { Box, IconButton } from '@mui/material';
import { useTranslation } from 'react-i18next';

import type { ProductUnit } from '../../api/types';
import { formatQuantity } from '../../lib/format';
import { roundQuantity } from '../../lib/shopping';
import { palette } from '../../theme';

/** − 2 L + : changes a quantity by the product's step, never below `min`. */
export function QuantityStepper({
  label,
  value,
  step,
  unit,
  min = step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  unit: ProductUnit;
  min?: number;
  onChange: (value: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const button = {
    width: 52,
    height: 52,
    bgcolor: palette.canvas,
    color: palette.navy,
    fontSize: 24,
    fontWeight: 300,
  };
  return (
    <Box role="group" aria-label={label} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ fontSize: 13, color: palette.textMuted }}>{label}</Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton
          aria-label={t('list.less')}
          disabled={value - step < min - 1e-9}
          onClick={() => onChange(roundQuantity(value - step))}
          sx={button}
        >
          −
        </IconButton>
        <Box
          aria-live="polite"
          sx={{ fontSize: 34, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}
        >
          {formatQuantity(value, unit, i18n.language)}
        </Box>
        <IconButton
          aria-label={t('list.more')}
          onClick={() => onChange(roundQuantity(value + step))}
          sx={button}
        >
          +
        </IconButton>
      </Box>
    </Box>
  );
}

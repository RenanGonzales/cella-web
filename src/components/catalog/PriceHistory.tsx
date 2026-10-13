import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { usePrices } from '../../api/hooks';
import type { ProductUnit } from '../../api/types';
import { formatMoney, formatQuantity } from '../../lib/format';
import { priceChange } from '../../lib/receipt';
import { palette } from '../../theme';

const WIDTH = 280;
const HEIGHT = 64;
const PAD = 6;

/** The prices paid for a product in its last purchases, as a small line. */
export function PriceHistory({ productId, unit }: { productId: string; unit: ProductUnit }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { data: points = [] } = usePrices(productId);
  if (points.length < 2) return null;

  const prices = points.map((point) => point.unit_price_cents);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const span = Math.max(high - low, 1);
  const xy = prices.map(
    (price, index) =>
      [
        PAD + (index / (prices.length - 1)) * (WIDTH - PAD * 2),
        HEIGHT - PAD - ((price - low) / span) * (HEIGHT - PAD * 2),
      ] as const,
  );
  const first = prices[0] ?? 0;
  const last = prices.at(-1) ?? 0;
  const [endX, endY] = xy.at(-1) ?? [0, 0];
  const change = priceChange(first, last) ?? 0;
  const per = unit === 'un' ? '' : ` / ${formatQuantity(1, unit, locale).replace(/^1\s?/, '')}`;

  return (
    <Box
      component="section"
      aria-label={t('prices.title')}
      sx={{ p: 2, borderRadius: '18px', bgcolor: palette.canvas }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, gap: 1 }}>
        <Box component="span" sx={{ fontWeight: 500 }}>
          {t('prices.title')}
        </Box>
        <Box component="span" sx={{ color: palette.textMuted }}>
          {formatMoney(last, locale)}
          {per}
          {' · '}
          {change === 0
            ? t('receipt.same')
            : t(change > 0 ? 'prices.up' : 'prices.down', {
                percent: Math.abs(change),
                count: points.length,
              })}
        </Box>
      </Box>
      <Box sx={{ position: 'relative', mt: 1 }}>
        <svg
          role="img"
          aria-label={t('prices.chart', {
            from: formatMoney(first, locale),
            to: formatMoney(last, locale),
            count: points.length,
          })}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          height={HEIGHT}
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          <polyline
            points={xy.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={palette.navyMid}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            left: `calc(${(endX / WIDTH) * 100}% - 4px)`,
            top: endY - 4,
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: palette.navy,
          }}
        />
      </Box>
    </Box>
  );
}

import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { HEALTH_TONES, fillRatio, healthOf, minimumMark } from '../lib/health';
import type { Stock } from '../lib/health';
import { palette } from '../theme';

/**
 * Stock bar in the health tone, with a tick where the minimum is. With `segments`, one
 * rounded block per "Use" (eggs: 12 blocks), like the rest of the design.
 */
export function StockMeter({
  stock,
  height = 8,
  segments,
  label,
  over,
}: {
  stock: Stock;
  height?: number;
  /** Number of blocks (ideal / step) when they are few enough to count. */
  segments?: number;
  label?: string;
  /** Shown after a full bar when the stock is above the ideal ("+20"). */
  over?: string;
}) {
  const tone = HEALTH_TONES[healthOf(stock)];
  const mark = minimumMark(stock);
  const ratio = fillRatio(stock);
  const filled = segments ? Math.round(ratio * segments) : 0;

  const bar = (
    <Box
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      sx={{ position: 'relative', pt: mark !== null ? '5px' : 0, flex: 1, minWidth: 0 }}
    >
      {segments ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))`,
            gap: segments > 20 ? '3px' : '5px',
          }}
        >
          {Array.from({ length: segments }, (_, index) => (
            <Box
              key={index}
              sx={{
                height,
                borderRadius: `${Math.min(8, height / 2.5)}px`,
                bgcolor: index < filled ? tone.fill : palette.track,
                transition: 'background-color .3s ease',
              }}
            />
          ))}
        </Box>
      ) : (
        <Box sx={{ height, borderRadius: height / 2, bgcolor: palette.track, overflow: 'hidden' }}>
          <Box
            sx={{
              height,
              width: `${ratio * 100}%`,
              bgcolor: tone.fill,
              borderRadius: height / 2,
              transition: 'width .3s ease, background-color .3s ease',
            }}
          />
        </Box>
      )}
      {mark !== null && (
        <Box
          data-testid="minimum-mark"
          sx={{
            position: 'absolute',
            top: 0,
            bottom: -3,
            left: `calc(${mark * 100}% - 1px)`,
            width: 2,
            borderRadius: 1,
            bgcolor: palette.navy,
          }}
        />
      )}
    </Box>
  );

  if (!over) return bar;
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
      {bar}
      <Box
        component="span"
        data-testid="over-ideal"
        sx={{
          px: 1,
          lineHeight: `${Math.max(height, 18)}px`,
          borderRadius: 999,
          bgcolor: HEALTH_TONES.full.fill,
          color: HEALTH_TONES.full.text,
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        {over}
      </Box>
    </Box>
  );
}

/** Small pill with the health word ("Low"), in the same tone as the bar. */
export function HealthChip({ stock, onList = false }: { stock: Stock; onList?: boolean }) {
  const { t } = useTranslation();
  const health = healthOf(stock);
  const tone = HEALTH_TONES[health];
  return (
    <Box
      component="span"
      sx={{
        alignSelf: 'flex-start',
        px: 1.25,
        py: 0.5,
        borderRadius: 999,
        bgcolor: tone.fill,
        color: tone.text,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {t(`health.${health}`)}
      {onList ? ` · ${t('health.onList')}` : ''}
    </Box>
  );
}

/** "Min 6 · Ideal 12", or "Buys when it runs out · Ideal 1" when the minimum is zero. */
export function StockRules({ stock, format }: { stock: Stock; format: (value: number) => string }) {
  const { t } = useTranslation();
  return (
    <Box component="span" sx={{ fontSize: 13, color: palette.textMuted }}>
      {stock.min > 0 ? t('health.min', { value: format(stock.min) }) : t('health.minZero')}
      {' · '}
      {t('health.ideal', { value: format(stock.ideal) })}
    </Box>
  );
}

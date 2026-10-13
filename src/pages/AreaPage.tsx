import { Box, Button, IconButton, Skeleton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';

import { useProducts, useStorageAreas } from '../api/hooks';
import type { Product } from '../api/types';
import { useConsumeAction } from '../components/ConsumeProvider';
import { HealthChip, StockMeter, StockRules } from '../components/StockMeter';
import { BigNumber, Icon } from '../components/ui';
import { formatQuantity } from '../lib/format';
import { overIdeal } from '../lib/health';
import { stockOf } from '../lib/stats';
import { palette } from '../theme';

/** Bars with more segments than this are drawn proportionally instead. */
const MAX_SEGMENTS = 12;

export function AreaPage() {
  const { areaId } = useParams();
  const { t } = useTranslation();
  const { data: areas } = useStorageAreas();
  const { data: products = [], isLoading } = useProducts();
  const consume = useConsumeAction();

  const area = areas?.find((candidate) => candidate.id === areaId);
  const inArea = products
    .filter((product) => product.storage_area_id === areaId)
    // Products at their minimum first, then by name.
    .sort(
      (a, b) => Number(b.needs_restock) - Number(a.needs_restock) || a.name.localeCompare(b.name),
    );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box
        component="header"
        sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: { xs: 1, md: 0 } }}
      >
        <IconButton
          component={RouterLink}
          to="/"
          aria-label={t('area.back')}
          sx={{ bgcolor: palette.surface, color: palette.navy }}
        >
          <Icon name="back" size={20} />
        </IconButton>
        <Box>
          <Box
            component="h1"
            sx={{ m: 0, fontSize: { xs: 30, md: 36 }, fontWeight: 500, letterSpacing: '-0.03em' }}
          >
            {area ? t(`areas.${area.name}`, { defaultValue: area.name }) : ' '}
          </Box>
          <Box component="p" sx={{ m: 0, color: palette.textMuted }}>
            {t('area.products', { count: inArea.length })}
          </Box>
        </Box>
      </Box>

      {isLoading ? (
        <Skeleton variant="rounded" height={160} sx={{ borderRadius: '30px' }} />
      ) : inArea.length === 0 ? (
        <Box
          sx={{ p: 3, borderRadius: '30px', bgcolor: palette.surface, color: palette.textMuted }}
        >
          {t('area.empty')}
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
            gap: 1.25,
          }}
        >
          {inArea.map((product) => (
            <ProductCard key={product.id} product={product} onUse={() => consume(product)} />
          ))}
        </Box>
      )}
    </Box>
  );
}

function ProductCard({ product, onUse }: { product: Product; onUse: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const format = (value: number) => formatQuantity(value, product.unit, locale);
  const amount = format(product.consume_step);
  const steps = Math.round(product.ideal_quantity / product.consume_step);
  const stock = stockOf(product);
  const over = overIdeal(stock);
  const unitLabel = formatQuantity(0, product.unit, locale).replace(/^0\s?/, '');

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: '30px',
        bgcolor: palette.surface,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: 17, fontWeight: 500 }}>{product.name}</Box>
          <Box sx={{ fontSize: 13, color: palette.textMuted }}>{product.brand ?? ' '}</Box>
        </Box>
        <HealthChip stock={stock} onList={product.needs_restock} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <BigNumber
          value={new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(
            product.current_quantity,
          )}
          suffix={unitLabel || undefined}
          size={52}
        />
        <Box component="span" sx={{ fontSize: 13, color: palette.textSoft }}>
          {over > 0
            ? t('area.overIdeal', { over: format(over) })
            : t('area.ofIdeal', { ideal: format(product.ideal_quantity) })}
        </Box>
      </Box>

      <StockMeter
        stock={stock}
        height={14}
        segments={steps > 0 && steps <= MAX_SEGMENTS ? steps : undefined}
        label={t('health.aria', {
          current: format(product.current_quantity),
          min: format(product.min_quantity),
          ideal: format(product.ideal_quantity),
        })}
        over={over > 0 ? `+${format(over)}` : undefined}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <StockRules stock={stock} format={format} />
        <Button
          variant="contained"
          onClick={onUse}
          data-tour={`use-${product.name}`}
          disabled={product.current_quantity <= 0}
          aria-label={t('area.useAria', { amount, name: product.name })}
        >
          {t('area.use', { amount })}
        </Button>
      </Box>
    </Box>
  );
}

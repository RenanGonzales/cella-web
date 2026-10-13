import { Box, Skeleton } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { useConsumption } from '../../api/hooks';
import { formatQuantity } from '../../lib/format';
import { palette } from '../../theme';
import { BigNumber, Card } from '../ui';

const TOP = 5;

/** What the household used in the last 7 days, from the "Use" taps. */
export function UsedThisWeek() {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useConsumption(7);

  if (isLoading || !data) {
    return <Skeleton variant="rounded" height={190} sx={{ borderRadius: '30px' }} />;
  }
  return (
    <Card padding={2.75}>
      <Box component="h2" sx={{ m: 0, fontSize: 15, fontWeight: 500 }}>
        {t('used.title')}
      </Box>
      <Box sx={{ mt: 2 }}>
        <BigNumber value={data.times} suffix={t('used.taps', { count: data.times })} size={44} />
      </Box>
      {data.products.length === 0 ? (
        <Box sx={{ mt: 1, color: palette.textMuted }}>{t('used.none')}</Box>
      ) : (
        <Box
          component="ul"
          aria-label={t('used.title')}
          sx={{ m: 0, mt: 1.5, p: 0, listStyle: 'none' }}
        >
          {data.products.slice(0, TOP).map((product) => (
            <Box
              component="li"
              key={product.product_id}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 1,
                py: 0.75,
                fontSize: 14,
                borderTop: `1px solid ${palette.canvas}`,
              }}
            >
              <span>{product.name}</span>
              <Box component="span" sx={{ color: palette.textMuted, whiteSpace: 'nowrap' }}>
                {formatQuantity(product.quantity, product.unit, i18n.language)}
                {product.unit === 'un' ? ` ${t('used.units', { count: product.quantity })}` : ''}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
}

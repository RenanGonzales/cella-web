import { Box, Button, ButtonBase, Skeleton } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';

import { useMe, useProducts, useShoppingList, useStorageAreas } from '../api/hooks';
import type { Product } from '../api/types';
import { useConsumeAction } from '../components/ConsumeProvider';
import { BigNumber, Card, Icon, Money, SegmentBar, StockRing } from '../components/ui';
import { formatQuantity, splitMoney } from '../lib/format';
import { areaStats, listStats, runningLow, stockRatio } from '../lib/stats';
import { palette } from '../theme';

export function HomePage() {
  const { t, i18n } = useTranslation();
  const { data: me } = useMe();
  const { data: areas, isLoading: areasLoading } = useStorageAreas();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: list } = useShoppingList();
  const consume = useConsumeAction();

  const loading = areasLoading || productsLoading;
  const stats = listStats(list, products);
  const low = runningLow(products);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box component="header" sx={{ px: { xs: 1, md: 0 }, pt: { xs: 1, md: 0 } }}>
        <Box
          component="h1"
          sx={{ m: 0, fontSize: { xs: 34, md: 40 }, fontWeight: 500, letterSpacing: '-0.03em' }}
        >
          {t('home.title')}
        </Box>
        <Box component="p" sx={{ m: 0, mt: 0.5, color: palette.textMuted }}>
          {me ? `${t('home.greeting', { name: me.name })} · ` : ''}
          {t('home.summary', { areas: areas?.length ?? 0, products: products.length })}
        </Box>
      </Box>

      <ButtonBase
        component={RouterLink}
        to="/list"
        sx={{ display: 'block', textAlign: 'left', borderRadius: '30px', color: 'inherit' }}
      >
        <Card highlight padding={3}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 500,
            }}
          >
            {t('home.shoppingList')}
            <Icon name="arrow" size={20} />
          </Box>
          <Box
            sx={{
              mt: 3,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <BigNumber value={stats.items} suffix={t('home.items', { count: stats.items })} />
            <Box sx={{ display: 'flex', gap: 3.5 }}>
              <Stat label={t('home.empty')} value={stats.empty} />
              <Stat label={t('home.atMinimum')} value={stats.atMinimum} />
              <Stat
                label={t('home.estimated')}
                value={<Money parts={splitMoney(stats.estimatedCents, i18n.language)} />}
              />
            </Box>
          </Box>
          <Box sx={{ mt: 2.5 }}>
            {stats.items > 0 ? (
              <SegmentBar
                strong={stats.empty}
                soft={stats.atMinimum}
                total={stats.items}
                label={t('home.listDetail', { empty: stats.empty, atMinimum: stats.atMinimum })}
              />
            ) : (
              <Box sx={{ color: palette.textMuted }}>{t('home.listEmpty')}</Box>
            )}
          </Box>
        </Card>
      </ButtonBase>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.75, alignItems: 'flex-start' }}>
        <Box
          component="section"
          aria-label={t('nav.home')}
          sx={{
            flex: '999 1 420px',
            minWidth: 0,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(auto-fill, minmax(170px, 1fr))',
            },
            gap: 1.25,
          }}
        >
          {loading
            ? Array.from({ length: 4 }, (_, index) => (
                <Skeleton
                  key={index}
                  variant="rounded"
                  height={150}
                  sx={{ borderRadius: '30px' }}
                />
              ))
            : areas?.map((area) => {
                const inArea = products.filter((product) => product.storage_area_id === area.id);
                const areaInfo = areaStats(inArea);
                return (
                  <ButtonBase
                    key={area.id}
                    component={RouterLink}
                    to={`/areas/${area.id}`}
                    sx={{
                      height: { xs: 140, md: 168 },
                      p: 2.25,
                      borderRadius: '30px',
                      bgcolor: palette.surface,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      color: palette.navy,
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <StockRing percent={areaInfo.percent} warn={areaInfo.low > 0} />
                      <Box
                        component="span"
                        sx={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: areaInfo.low ? palette.navyMid : palette.textMuted,
                        }}
                      >
                        {areaInfo.low ? t('home.low', { count: areaInfo.low }) : t('home.allGood')}
                      </Box>
                    </Box>
                    <Box>
                      <Box sx={{ fontSize: 17, fontWeight: 500 }}>
                        {t(`areas.${area.name}`, { defaultValue: area.name })}
                      </Box>
                      <Box sx={{ fontSize: 13, color: palette.textMuted }}>
                        {t('home.areaDetail', { count: areaInfo.count, percent: areaInfo.percent })}
                      </Box>
                    </Box>
                  </ButtonBase>
                );
              })}
        </Box>

        {low.length > 0 && (
          <Box
            component="section"
            aria-labelledby="running-low"
            sx={{
              flex: '1 1 320px',
              minWidth: 0,
              p: 2.5,
              pb: 1,
              borderRadius: '30px',
              bgcolor: palette.surface,
            }}
          >
            <Box
              component="h2"
              id="running-low"
              sx={{ m: 0, mb: 1, fontSize: 15, fontWeight: 500 }}
            >
              {t('home.runningLow')}
            </Box>
            {low.map((product) => (
              <LowRow
                key={product.id}
                product={product}
                onUse={() => consume(product)}
                locale={i18n.language}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box component="span" sx={{ fontSize: 13, color: palette.textMuted }}>
        {label}
      </Box>
      <Box component="span" sx={{ fontSize: 24, letterSpacing: '-0.03em' }}>
        {value}
      </Box>
    </Box>
  );
}

function LowRow({
  product,
  onUse,
  locale,
}: {
  product: Product;
  onUse: () => void;
  locale: string;
}) {
  const { t } = useTranslation();
  const ratio = stockRatio(product);
  const amount = formatQuantity(product.consume_step, product.unit, locale);
  return (
    <Box
      sx={{
        minHeight: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 1.75,
        borderTop: `1px solid ${palette.canvas}`,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, gap: 1 }}>
          <Box
            component="span"
            sx={{
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {product.name}
          </Box>
          <Box component="span" sx={{ color: palette.textMuted, whiteSpace: 'nowrap' }}>
            {formatQuantity(product.current_quantity, product.unit, locale)} /{' '}
            {formatQuantity(product.ideal_quantity, product.unit, locale)}
          </Box>
        </Box>
        <Box
          aria-hidden="true"
          sx={{ height: 6, borderRadius: 3, bgcolor: palette.track, overflow: 'hidden' }}
        >
          <Box
            sx={{
              height: 6,
              width: `${ratio * 100}%`,
              bgcolor: ratio === 0 ? palette.navy : palette.steel,
              transition: 'width .3s ease',
            }}
          />
        </Box>
      </Box>
      <Button
        size="small"
        onClick={onUse}
        disabled={product.current_quantity <= 0}
        aria-label={t('area.useAria', { amount, name: product.name })}
        sx={{ bgcolor: palette.canvas, color: palette.navy, minHeight: 36 }}
      >
        {t('home.use')}
      </Button>
    </Box>
  );
}

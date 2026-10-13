import { Box, Button, ButtonBase, Skeleton, Snackbar } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';

import {
  useArchiveMarket,
  useArchivedMarkets,
  useCreateMarket,
  useMarkets,
  useRestoreMarket,
  useUpdateMarket,
} from '../api/hooks';
import type { Market } from '../api/types';
import { MarketDialog } from '../components/catalog/MarketDialog';
import { Pill } from '../components/list/ItemDialog';
import { Icon } from '../components/ui';
import { MARKET_KEY } from '../lib/shopping';
import { useStoredString } from '../lib/storage';
import { glow, palette } from '../theme';

/** The household's markets; the one chosen here sorts the shopping list. */
export function MarketsPage() {
  const { t } = useTranslation();
  const [showArchived, setShowArchived] = useState(false);
  const { data: active = [], isLoading } = useMarkets();
  const { data: archived = [] } = useArchivedMarkets(showArchived);
  const [storedMarket, setStoredMarket] = useStoredString(MARKET_KEY);
  const createMarket = useCreateMarket();
  const updateMarket = useUpdateMarket();
  const archiveMarket = useArchiveMarket();
  const restoreMarket = useRestoreMarket();
  const [editing, setEditing] = useState<Market | 'new' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Same rule as the list: the remembered market, else the first one.
  const sortingId = active.find((market) => market.id === storedMarket)?.id ?? active[0]?.id;
  const markets = showArchived ? archived : active;
  const busy =
    createMarket.isPending ||
    updateMarket.isPending ||
    archiveMarket.isPending ||
    restoreMarket.isPending;
  const done = (key: string, name: string) => {
    setEditing(null);
    setMessage(t(key, { name }));
  };
  const failed = () => setMessage(t('errors.generic'));

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box
        component="header"
        sx={{
          px: { xs: 1, md: 0 },
          pt: { xs: 1, md: 0 },
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box>
          <Box
            component="h1"
            sx={{ m: 0, fontSize: { xs: 34, md: 40 }, fontWeight: 500, letterSpacing: '-0.03em' }}
          >
            {t('nav.markets')}
          </Box>
          <Box component="p" sx={{ m: 0, mt: 0.5, color: palette.textMuted }}>
            {t('markets.summary')}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Pill
            role="checkbox"
            selected={showArchived}
            onClick={() => setShowArchived(!showArchived)}
          >
            {t('products.archived')}
          </Pill>
          <Button
            variant="contained"
            startIcon={<Icon name="plus" size={18} />}
            onClick={() => setEditing('new')}
            sx={{ height: 48, px: 2.5 }}
          >
            {t('markets.new')}
          </Button>
        </Box>
      </Box>

      {isLoading ? (
        <Skeleton variant="rounded" height={180} sx={{ borderRadius: '30px' }} />
      ) : markets.length === 0 ? (
        <Box
          sx={{ p: 3, borderRadius: '26px', bgcolor: palette.surface, color: palette.textMuted }}
        >
          {showArchived ? t('markets.noArchived') : t('markets.empty')}
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
            gap: 1.25,
          }}
        >
          {markets.map((market) => {
            const sorting = !showArchived && market.id === sortingId;
            return (
              <Box
                key={market.id}
                component="section"
                aria-label={market.name}
                sx={{
                  p: 2.5,
                  borderRadius: '30px',
                  bgcolor: palette.surface,
                  backgroundImage: sorting ? glow : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Box component="h2" sx={{ m: 0, fontSize: 19, fontWeight: 500 }}>
                      {market.name}
                    </Box>
                    <Box sx={{ fontSize: 13, color: palette.textMuted }}>
                      {[market.chain, market.address].filter(Boolean).join(' · ') || ' '}
                    </Box>
                  </Box>
                  {sorting && (
                    <Box
                      component="span"
                      sx={{
                        alignSelf: 'flex-start',
                        px: 1.25,
                        py: 0.5,
                        borderRadius: 999,
                        bgcolor: palette.navy,
                        color: '#FFFFFF',
                        fontSize: 12,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t('markets.sorting')}
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                  <Box
                    component="span"
                    sx={{ fontSize: 44, letterSpacing: '-0.04em', lineHeight: 1 }}
                  >
                    {market.corridor_count}
                  </Box>
                  <Box component="span" sx={{ color: palette.textMuted }}>
                    {t('markets.corridors', { count: market.corridor_count })}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {!showArchived && (
                    <ButtonBase
                      component={RouterLink}
                      to={`/markets/${market.id}`}
                      aria-label={t('markets.planAria', { name: market.name })}
                      sx={{
                        height: 40,
                        px: 2,
                        borderRadius: 999,
                        bgcolor: palette.navy,
                        color: '#FFFFFF',
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      {market.has_plan ? t('markets.plan') : t('markets.createPlan')}
                    </ButtonBase>
                  )}
                  <ButtonBase
                    onClick={() => setEditing(market)}
                    aria-label={t('markets.editAria', { name: market.name })}
                    sx={{
                      height: 40,
                      px: 2,
                      borderRadius: 999,
                      bgcolor: palette.canvas,
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    {t('markets.edit')}
                  </ButtonBase>
                  {!showArchived && !sorting && (
                    <ButtonBase
                      onClick={() => {
                        setStoredMarket(market.id);
                        setMessage(t('markets.nowSorting', { name: market.name }));
                      }}
                      sx={{
                        height: 40,
                        px: 2,
                        borderRadius: 999,
                        bgcolor: palette.canvas,
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      {t('markets.useForList')}
                    </ButtonBase>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {editing && (
        <MarketDialog
          key={editing === 'new' ? 'new' : editing.id}
          market={editing === 'new' ? null : editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={(input) =>
            editing === 'new'
              ? createMarket.mutate(input, {
                  onSuccess: (market) => {
                    // A new market never changes how the list is sorted without asking.
                    if (sortingId && storedMarket !== sortingId) setStoredMarket(sortingId);
                    done('markets.created', market.name);
                  },
                  onError: failed,
                })
              : updateMarket.mutate(
                  { id: editing.id, changes: input },
                  { onSuccess: (market) => done('products.saved', market.name), onError: failed },
                )
          }
          onArchive={() =>
            editing !== 'new' &&
            archiveMarket.mutate(editing.id, {
              onSuccess: (market) => done('products.archivedDone', market.name),
              onError: failed,
            })
          }
          onRestore={() =>
            editing !== 'new' &&
            restoreMarket.mutate(editing.id, {
              onSuccess: (market) => done('products.restored', market.name),
              onError: failed,
            })
          }
        />
      )}

      <Snackbar
        key={message}
        open={message !== null}
        autoHideDuration={4000}
        onClose={(_, reason) => reason !== 'clickaway' && setMessage(null)}
        message={message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 104, md: 32 } }}
      />
    </Box>
  );
}

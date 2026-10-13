import { Box, Button, ButtonBase, InputBase, Skeleton, Snackbar } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import {
  useArchiveProduct,
  useArchivedProducts,
  useCategories,
  useCreateCategory,
  useCreateProduct,
  useProducts,
  useRestoreProduct,
  useStorageAreas,
  useUpdateProduct,
} from '../api/hooks';
import type { Category, Product } from '../api/types';
import { ProductDialog } from '../components/catalog/ProductDialog';
import { Pill } from '../components/list/ItemDialog';
import { Icon } from '../components/ui';
import { formatQuantity } from '../lib/format';
import { stockRatio } from '../lib/stats';
import { palette } from '../theme';

/** Lowercase without accents, so "acucar" finds "Açúcar". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** The catalog: search, filter by area, create, edit and archive products. */
export function ProductsPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const areaFilter = params.get('area');
  const showArchived = params.get('archived') === '1';

  const { data: areas = [] } = useStorageAreas();
  const { data: categories = [] } = useCategories();
  const { data: active = [], isLoading } = useProducts();
  const { data: archived = [] } = useArchivedProducts(showArchived);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const archiveProduct = useArchiveProduct();
  const restoreProduct = useRestoreProduct();
  const createCategory = useCreateCategory();

  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const setParam = (key: string, value: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const terms = normalize(search.trim());
  const products = (showArchived ? archived : active).filter(
    (product) =>
      (!areaFilter || product.storage_area_id === areaFilter) &&
      (!terms ||
        normalize(
          [product.name, product.brand ?? '', categoryName.get(product.category_id) ?? ''].join(
            ' ',
          ),
        ).includes(terms)),
  );
  const sections = areas
    .map((area) => ({
      area,
      products: products.filter((product) => product.storage_area_id === area.id),
    }))
    .filter((section) => section.products.length > 0);

  const done = (key: string, name: string) => {
    setEditing(null);
    setMessage(t(key, { name }));
  };
  const failed = () => setMessage(t('errors.generic'));
  const busy =
    createProduct.isPending ||
    updateProduct.isPending ||
    archiveProduct.isPending ||
    restoreProduct.isPending;
  const onList = active.filter((product) => product.needs_restock).length;

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
            {t('nav.products')}
          </Box>
          <Box component="p" sx={{ m: 0, mt: 0.5, color: palette.textMuted }}>
            {t('products.summary', { count: active.length, onList })}
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<Icon name="plus" size={18} />}
          onClick={() => setEditing('new')}
          sx={{ height: 48, px: 2.5 }}
        >
          {t('products.new')}
        </Button>
      </Box>

      <Box
        sx={{
          height: 52,
          borderRadius: 999,
          bgcolor: palette.surface,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 2.25,
          color: palette.textMuted,
        }}
      >
        <Icon name="search" size={18} />
        <InputBase
          value={search}
          onChange={(event) => setParam('q', event.target.value)}
          placeholder={t('nav.search')}
          inputProps={{ 'aria-label': t('nav.search'), type: 'search' }}
          sx={{ flex: 1, fontSize: 15 }}
        />
      </Box>

      <Box
        role="radiogroup"
        aria-label={t('products.filter')}
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}
      >
        <Pill selected={!areaFilter} onClick={() => setParam('area', null)}>
          {t('products.allAreas')}
        </Pill>
        {areas.map((area) => (
          <Pill
            key={area.id}
            selected={areaFilter === area.id}
            onClick={() => setParam('area', area.id)}
          >
            {t(`areas.${area.name}`, { defaultValue: area.name })}
          </Pill>
        ))}
        <Box sx={{ flex: 1 }} />
        <Pill
          role="checkbox"
          selected={showArchived}
          onClick={() => setParam('archived', showArchived ? null : '1')}
        >
          {t('products.archived')}
        </Pill>
      </Box>

      {isLoading ? (
        <Skeleton variant="rounded" height={240} sx={{ borderRadius: '26px' }} />
      ) : sections.length === 0 ? (
        <Box
          sx={{ p: 3, borderRadius: '26px', bgcolor: palette.surface, color: palette.textMuted }}
        >
          {showArchived ? t('products.noArchived') : t('products.noResults')}
        </Box>
      ) : (
        sections.map(({ area, products: inArea }) => (
          <Box
            component="section"
            key={area.id}
            aria-label={t(`areas.${area.name}`, { defaultValue: area.name })}
            sx={{ bgcolor: palette.surface, borderRadius: '26px', px: 2.25, pt: 1.75, pb: 0.75 }}
          >
            <Box
              component="h2"
              sx={{ m: 0, mb: 0.25, fontSize: 13, fontWeight: 400, color: palette.textMuted }}
            >
              {t(`areas.${area.name}`, { defaultValue: area.name })} · {inArea.length}
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                '& > * + *': { borderTop: `1px solid ${palette.canvas}` },
              }}
            >
              {inArea.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  category={categoryName.get(product.category_id)}
                  locale={i18n.language}
                  onOpen={() => setEditing(product)}
                />
              ))}
            </Box>
          </Box>
        ))
      )}

      {editing && (
        <ProductDialog
          key={editing === 'new' ? 'new' : editing.id}
          product={editing === 'new' ? null : editing}
          areas={areas}
          categories={categories}
          defaultAreaId={areaFilter ?? areas[0]?.id ?? null}
          busy={busy}
          onClose={() => setEditing(null)}
          onCreate={(input) =>
            createProduct.mutate(input, {
              onSuccess: (product) => done('products.created', product.name),
              onError: failed,
            })
          }
          onUpdate={(changes) =>
            editing !== 'new' &&
            updateProduct.mutate(
              { id: editing.id, changes },
              { onSuccess: (product) => done('products.saved', product.name), onError: failed },
            )
          }
          onArchive={() =>
            editing !== 'new' &&
            archiveProduct.mutate(editing.id, {
              onSuccess: (product) => done('products.archivedDone', product.name),
              onError: failed,
            })
          }
          onRestore={() =>
            editing !== 'new' &&
            restoreProduct.mutate(editing.id, {
              onSuccess: (product) => done('products.restored', product.name),
              onError: failed,
            })
          }
          onCreateCategory={(name): Promise<Category> => createCategory.mutateAsync(name)}
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

function ProductRow({
  product,
  category,
  locale,
  onOpen,
}: {
  product: Product;
  category?: string;
  locale: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const meta = [product.brand, category].filter(Boolean).join(' · ');
  return (
    <ButtonBase
      onClick={onOpen}
      aria-label={t('products.editAria', { name: product.name })}
      sx={{
        width: '100%',
        minHeight: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        textAlign: 'left',
        borderRadius: '14px',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box component="span" sx={{ fontSize: 15, fontWeight: 500 }}>
          {product.name}
        </Box>
        <Box component="span" sx={{ fontSize: 12, color: palette.textFaint }}>
          {meta || ' '}
        </Box>
      </Box>
      {product.needs_restock && product.archived_at === null && (
        <Box
          component="span"
          sx={{
            px: 1.25,
            py: 0.5,
            borderRadius: 999,
            bgcolor: palette.frost,
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            display: { xs: 'none', sm: 'inline' },
          }}
        >
          {t('area.onList')}
        </Box>
      )}
      <Box
        sx={{
          width: 96,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          alignItems: 'flex-end',
        }}
      >
        <Box component="span" sx={{ fontSize: 13, whiteSpace: 'nowrap' }}>
          {formatQuantity(product.current_quantity, product.unit, locale)}
          <Box component="span" sx={{ color: palette.textFaint }}>
            {' / '}
            {formatQuantity(product.ideal_quantity, product.unit, locale)}
          </Box>
        </Box>
        <Box
          aria-hidden="true"
          sx={{
            width: '100%',
            height: 6,
            borderRadius: 3,
            bgcolor: palette.track,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: 6,
              width: `${stockRatio(product) * 100}%`,
              bgcolor: product.needs_restock ? palette.steel : palette.navy,
            }}
          />
        </Box>
      </Box>
    </ButtonBase>
  );
}

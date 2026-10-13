import {
  Autocomplete,
  Box,
  Button,
  InputAdornment,
  TextField,
  createFilterOptions,
} from '@mui/material';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { Category, Product, ProductInput, ProductUnit, StorageArea } from '../../api/types';
import {
  changedFields,
  emptyForm,
  formFromProduct,
  toInput,
  validateProduct,
} from '../../lib/productForm';
import type { ProductForm, ProductFormErrors } from '../../lib/productForm';
import { palette } from '../../theme';
import { Pill } from '../list/ItemDialog';
import { Sheet } from '../list/Sheet';

const UNITS: ProductUnit[] = ['un', 'kg', 'g', 'l', 'ml'];

/** An existing category, or the "Create …" entry typed in the search. */
type CategoryOption = Category | { id: null; name: string; create: true };
const filter = createFilterOptions<CategoryOption>();

/** Create or edit a product: what it is, where it lives, and the stock rules. */
export function ProductDialog({
  product,
  areas,
  categories,
  defaultAreaId,
  busy,
  onClose,
  onCreate,
  onUpdate,
  onArchive,
  onRestore,
  onCreateCategory,
}: {
  /** Null for a new product. */
  product: Product | null;
  areas: StorageArea[];
  categories: Category[];
  defaultAreaId: string | null;
  busy: boolean;
  onClose: () => void;
  onCreate: (input: ProductInput) => void;
  onUpdate: (changes: Partial<ProductInput>) => void;
  onArchive: () => void;
  onRestore: () => void;
  onCreateCategory: (name: string) => Promise<Category>;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ProductForm>(() =>
    product ? formFromProduct(product) : emptyForm(defaultAreaId),
  );
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [creatingCategory, setCreatingCategory] = useState(false);

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const save = () => {
    const found = validateProduct(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const input = toInput(form);
    if (!product) return onCreate(input);
    const changes = changedFields(product, input);
    if (Object.keys(changes).length === 0) onClose();
    else onUpdate(changes);
  };

  const chooseCategory = async (option: CategoryOption | string | null) => {
    if (option === null) return set('categoryId', null);
    const name = typeof option === 'string' ? option.trim() : option.name;
    if (typeof option !== 'string' && option.id !== null) return set('categoryId', option.id);
    const existing = categories.find(
      (category) => category.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) return set('categoryId', existing.id);
    if (!name) return;
    setCreatingCategory(true);
    try {
      set('categoryId', (await onCreateCategory(name)).id);
    } catch {
      setErrors((current) => ({ ...current, categoryId: 'products.errors.categoryCreate' }));
    } finally {
      setCreatingCategory(false);
    }
  };

  const unitLabel = t(`units.${form.unit}`);
  const quantityField = (key: 'step' | 'minimum' | 'ideal' | 'current') => (
    <TextField
      label={t(`products.fields.${key}`)}
      value={form[key]}
      onChange={(event) => set(key, event.target.value)}
      error={Boolean(errors[key])}
      helperText={t(errors[key] ?? `products.hints.${key}`)}
      slotProps={{
        htmlInput: { inputMode: 'decimal' },
        input: unitLabel
          ? { endAdornment: <InputAdornment position="end">{unitLabel}</InputAdornment> }
          : undefined,
      }}
    />
  );

  const archived = product?.archived_at != null;
  const selectedCategory = categories.find((category) => category.id === form.categoryId) ?? null;

  return (
    <Sheet
      open
      wide
      onClose={onClose}
      title={product ? product.name : t('products.newTitle')}
      actions={
        <>
          {product &&
            (archived ? (
              <Button onClick={onRestore} disabled={busy} sx={{ mr: 'auto' }}>
                {t('products.restore')}
              </Button>
            ) : (
              <Button
                onClick={onArchive}
                disabled={busy}
                sx={{ mr: 'auto', color: palette.textMuted }}
              >
                {t('products.archive')}
              </Button>
            ))}
          <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
            {t('list.close')}
          </Button>
          <Button variant="contained" onClick={save} disabled={busy || creatingCategory}>
            {t('list.save')}
          </Button>
        </>
      }
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <TextField
          label={t('products.fields.name')}
          value={form.name}
          onChange={(event) => set('name', event.target.value)}
          error={Boolean(errors.name)}
          helperText={errors.name ? t(errors.name) : ' '}
          autoFocus={!product}
        />
        <TextField
          label={t('products.fields.brand')}
          value={form.brand}
          onChange={(event) => set('brand', event.target.value)}
          helperText={t('products.hints.brand')}
        />
      </Box>

      <Autocomplete<CategoryOption, false, false, true>
        freeSolo
        options={categories}
        value={selectedCategory}
        onChange={(_, option) => void chooseCategory(option)}
        getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
        isOptionEqualToValue={(option, value) =>
          typeof value !== 'string' && option.id === value.id
        }
        filterOptions={(options, state) => {
          const filtered = filter(options, state);
          const typed = state.inputValue.trim();
          const exists = options.some(
            (option) => option.name.toLowerCase() === typed.toLowerCase(),
          );
          if (typed && !exists) filtered.push({ id: null, name: typed, create: true });
          return filtered;
        }}
        renderOption={(props, option) => {
          const { key, ...rest } = props as typeof props & { key: string };
          return (
            <li key={key} {...rest}>
              {'create' in option
                ? t('products.createCategory', { name: option.name })
                : option.name}
            </li>
          );
        }}
        loading={creatingCategory}
        renderInput={(params) => (
          <TextField
            {...params}
            label={t('products.fields.category')}
            error={Boolean(errors.categoryId)}
            helperText={t(errors.categoryId ?? 'products.hints.category')}
          />
        )}
      />

      <Field
        label={t('products.fields.area')}
        error={errors.storageAreaId && t(errors.storageAreaId)}
      >
        {areas.map((area) => (
          <Pill
            key={area.id}
            selected={form.storageAreaId === area.id}
            onClick={() => set('storageAreaId', area.id)}
          >
            {t(`areas.${area.name}`, { defaultValue: area.name })}
          </Pill>
        ))}
      </Field>

      <Field label={t('products.fields.unit')}>
        {UNITS.map((unit) => (
          <Pill key={unit} selected={form.unit === unit} onClick={() => set('unit', unit)}>
            {t(`products.units.${unit}`)}
          </Pill>
        ))}
      </Field>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        {quantityField('current')}
        {quantityField('step')}
        {quantityField('minimum')}
        {quantityField('ideal')}
      </Box>
    </Sheet>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | false;
  children: ReactNode;
}) {
  return (
    <Box
      role="radiogroup"
      aria-label={label}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Box sx={{ fontSize: 13, color: error ? 'error.main' : palette.textMuted }}>
        {error || label}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>{children}</Box>
    </Box>
  );
}

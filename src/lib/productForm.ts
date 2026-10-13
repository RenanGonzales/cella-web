import type { Product, ProductInput, ProductUnit } from '../api/types';

/** The product form as typed: numbers stay text until saved ("0,5" works too). */
export interface ProductForm {
  name: string;
  brand: string;
  categoryId: string | null;
  storageAreaId: string | null;
  unit: ProductUnit;
  step: string;
  minimum: string;
  ideal: string;
  current: string;
}

export type ProductFormErrors = Partial<Record<keyof ProductForm, string>>;

/** "0,5" or "0.5" -> 0.5. Null when it is not a number the API accepts (>= 0, 3 decimals). */
export function parseQuantity(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) return null;
  return Number(normalized);
}

export function emptyForm(storageAreaId: string | null): ProductForm {
  return {
    name: '',
    brand: '',
    categoryId: null,
    storageAreaId,
    unit: 'un',
    step: '1',
    minimum: '1',
    ideal: '2',
    current: '0',
  };
}

export function formFromProduct(product: Product): ProductForm {
  return {
    name: product.name,
    brand: product.brand ?? '',
    categoryId: product.category_id,
    storageAreaId: product.storage_area_id,
    unit: product.unit,
    step: String(product.consume_step),
    minimum: String(product.min_quantity),
    ideal: String(product.ideal_quantity),
    current: String(product.current_quantity),
  };
}

/**
 * Same rules as the API, checked before sending, so mistakes show next to the field.
 * Messages are i18n keys.
 */
export function validateProduct(form: ProductForm): ProductFormErrors {
  const errors: ProductFormErrors = {};
  if (!form.name.trim()) errors.name = 'products.errors.name';
  if (!form.categoryId) errors.categoryId = 'products.errors.category';
  if (!form.storageAreaId) errors.storageAreaId = 'products.errors.area';

  const step = parseQuantity(form.step);
  const minimum = parseQuantity(form.minimum);
  const ideal = parseQuantity(form.ideal);
  const current = parseQuantity(form.current);
  if (step === null || step <= 0) errors.step = 'products.errors.step';
  if (minimum === null) errors.minimum = 'products.errors.number';
  if (ideal === null) errors.ideal = 'products.errors.number';
  if (current === null) errors.current = 'products.errors.number';
  if (minimum !== null && ideal !== null && minimum > ideal) {
    errors.minimum = 'products.errors.minAboveIdeal';
  }
  return errors;
}

/** The API body of a valid form. */
export function toInput(form: ProductForm): ProductInput {
  return {
    name: form.name.trim(),
    brand: form.brand.trim() || null,
    category_id: form.categoryId!,
    storage_area_id: form.storageAreaId!,
    unit: form.unit,
    consume_step: parseQuantity(form.step)!,
    min_quantity: parseQuantity(form.minimum)!,
    ideal_quantity: parseQuantity(form.ideal)!,
    current_quantity: parseQuantity(form.current)!,
  };
}

/** Only what changed, for PATCH. */
export function changedFields(product: Product, input: ProductInput): Partial<ProductInput> {
  const changes: Partial<ProductInput> = {};
  for (const key of Object.keys(input) as (keyof ProductInput)[]) {
    if (input[key] !== product[key]) Object.assign(changes, { [key]: input[key] });
  }
  return changes;
}

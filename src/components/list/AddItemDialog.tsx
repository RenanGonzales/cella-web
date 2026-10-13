import { Autocomplete, Button, TextField } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Product } from '../../api/types';
import { suggestedQuantity } from '../../lib/shopping';
import { QuantityStepper } from './QuantityStepper';
import { Sheet } from './Sheet';

/** Add a product by hand: pick it from the catalog, adjust how much to buy. */
export function AddItemDialog({
  open,
  products,
  onClose,
  onAdd,
}: {
  open: boolean;
  /** Products that can be added (active, not on the list yet). */
  products: Product[];
  onClose: () => void;
  onAdd: (product: Product, quantity: number) => void;
}) {
  const { t } = useTranslation();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);

  const choose = (chosen: Product | null) => {
    setProduct(chosen);
    if (chosen) setQuantity(suggestedQuantity(chosen));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('list.addTitle')}
      actions={
        <>
          <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
            {t('list.close')}
          </Button>
          <Button
            variant="contained"
            disabled={!product}
            onClick={() => product && onAdd(product, quantity)}
          >
            {t('list.addConfirm')}
          </Button>
        </>
      }
    >
      <Autocomplete
        options={products}
        value={product}
        onChange={(_, value) => choose(value)}
        getOptionLabel={(option) =>
          option.brand ? `${option.name} · ${option.brand}` : option.name
        }
        noOptionsText={t('list.noProducts')}
        autoHighlight
        renderInput={(params) => <TextField {...params} label={t('list.product')} autoFocus />}
      />
      {product && (
        <QuantityStepper
          label={t('list.toBuy')}
          value={quantity}
          step={product.consume_step > 0 ? product.consume_step : 1}
          unit={product.unit}
          onChange={setQuantity}
        />
      )}
    </Sheet>
  );
}

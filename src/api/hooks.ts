import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import type {
  ConsumeResponse,
  Me,
  Product,
  ShoppingList,
  StorageArea,
  UndoResponse,
} from './types';

export const keys = {
  me: ['me'] as const,
  areas: ['storage-areas'] as const,
  products: ['products'] as const,
  list: ['shopping-list'] as const,
};

/** The shared list changes when someone else consumes: refresh it every few seconds. */
const LIVE_REFRESH_MS = 3000;

export function useMe(enabled = true) {
  return useQuery({ queryKey: keys.me, queryFn: () => api<Me>('/me'), enabled });
}

export function useStorageAreas() {
  return useQuery({ queryKey: keys.areas, queryFn: () => api<StorageArea[]>('/storage-areas') });
}

export function useProducts() {
  return useQuery({ queryKey: keys.products, queryFn: () => api<Product[]>('/products') });
}

export function useShoppingList() {
  return useQuery({
    queryKey: keys.list,
    queryFn: () => api<ShoppingList>('/shopping-list'),
    refetchInterval: LIVE_REFRESH_MS,
  });
}

function replaceProduct(products: Product[] | undefined, updated: Product) {
  return products?.map((product) => (product.id === updated.id ? updated : product));
}

/**
 * Consume one step of a product. Optimistic: the number drops on screen right away and
 * rolls back if the API refuses.
 */
export function useConsume() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (product: Product) =>
      api<ConsumeResponse>(`/products/${product.id}/consume`, { method: 'POST' }),
    onMutate: async (product) => {
      await client.cancelQueries({ queryKey: keys.products });
      const previous = client.getQueryData<Product[]>(keys.products);
      const left = Math.max(0, product.current_quantity - product.consume_step);
      client.setQueryData<Product[]>(keys.products, (products) =>
        replaceProduct(products, { ...product, current_quantity: left }),
      );
      return { previous };
    },
    onError: (_error, _product, context) => {
      if (context?.previous) client.setQueryData(keys.products, context.previous);
    },
    onSuccess: (data) => {
      client.setQueryData<Product[]>(keys.products, (products) =>
        replaceProduct(products, data.product),
      );
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.list }),
  });
}

export function useUndo() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) =>
      api<UndoResponse>(`/consumption-events/${eventId}/undo`, { method: 'POST' }),
    onSuccess: (data) => {
      client.setQueryData<Product[]>(keys.products, (products) =>
        replaceProduct(products, data.product),
      );
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.list }),
  });
}

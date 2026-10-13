import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Layout, Plan } from '../lib/plan';
import { layoutBody } from '../lib/plan';
import { api } from './client';
import type {
  Category,
  CheckoutResponse,
  ConsumeResponse,
  ConsumptionSummary,
  ItemChanges,
  Market,
  MarketInput,
  Me,
  MonthSpending,
  PricePoint,
  Product,
  ProductInput,
  PurchaseDetail,
  PurchaseSummary,
  ReceiptConfirm,
  ReceiptDraft,
  ShoppingList,
  ShoppingListItem,
  StorageArea,
  UndoResponse,
} from './types';

export const keys = {
  me: ['me'] as const,
  areas: ['storage-areas'] as const,
  products: ['products'] as const,
  /** Prefix of every view of the list (grouped by category or by a market). */
  list: ['shopping-list'] as const,
  listView: (marketId: string | null) => ['shopping-list', marketId ?? 'default'] as const,
  markets: ['markets'] as const,
  archivedMarkets: ['markets', 'archived'] as const,
  categories: ['categories'] as const,
  layout: (marketId: string) => ['markets', marketId, 'layout'] as const,
  archivedProducts: ['products', 'archived'] as const,
  purchases: ['purchases'] as const,
  purchase: (id: string) => ['purchases', id] as const,
  spending: (months: number) => ['stats', 'spending', months] as const,
  consumption: (days: number) => ['stats', 'consumption', days] as const,
  prices: (productId: string) => ['products', productId, 'prices'] as const,
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

/**
 * The active list. With `marketId`, grouped by that market's corridors; without it, by the
 * market chosen when shopping started, or by category.
 */
export function useShoppingList(marketId: string | null = null) {
  const query = marketId ? `?market_id=${encodeURIComponent(marketId)}` : '';
  return useQuery({
    queryKey: keys.listView(marketId),
    queryFn: () => api<ShoppingList>(`/shopping-list${query}`),
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export function useMarkets() {
  return useQuery({ queryKey: keys.markets, queryFn: () => api<Market[]>('/markets') });
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

// --- Shopping list ----------------------------------------------------------

type ListSnapshot = [readonly unknown[], ShoppingList | undefined][];

/** Apply a change to every cached view of the list at once, keeping a copy for rollback. */
async function patchListCaches(
  client: ReturnType<typeof useQueryClient>,
  change: (items: ShoppingListItem[]) => ShoppingListItem[],
): Promise<ListSnapshot> {
  await client.cancelQueries({ queryKey: keys.list });
  const snapshot = client.getQueriesData<ShoppingList>({ queryKey: keys.list });
  client.setQueriesData<ShoppingList>({ queryKey: keys.list }, (list) => {
    if (!list) return list;
    const groups = list.groups
      .map((group) => ({ ...group, items: change(group.items) }))
      .filter((group) => group.items.length > 0);
    const item_count = groups.reduce((sum, group) => sum + group.items.length, 0);
    return { ...list, groups, item_count };
  });
  return snapshot;
}

function restore(client: ReturnType<typeof useQueryClient>, snapshot?: ListSnapshot) {
  snapshot?.forEach(([key, data]) => client.setQueryData(key, data));
}

/** What an item looks like after a change, mirroring the API rules. */
export function applyItemChanges(item: ShoppingListItem, changes: ItemChanges): ShoppingListItem {
  const next = { ...item, ...changes };
  if (next.status === 'checked') {
    next.quantity_bought = changes.quantity_bought ?? item.quantity_bought ?? next.quantity_needed;
  } else {
    next.quantity_bought = null;
  }
  return next;
}

export function useAddItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { product_id: string; quantity_needed: number }) =>
      api<ShoppingList>('/shopping-list/items', { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.list }),
  });
}

/** Change an item. Optimistic, so checking items off in the store feels instant. */
export function useUpdateItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: ItemChanges }) =>
      api<ShoppingList>(`/shopping-list/items/${id}`, { method: 'PATCH', body: changes }),
    onMutate: ({ id, changes }) =>
      patchListCaches(client, (items) =>
        items.map((item) => (item.id === id ? applyItemChanges(item, changes) : item)),
      ),
    onError: (_error, _variables, snapshot) => restore(client, snapshot),
    onSettled: () => client.invalidateQueries({ queryKey: keys.list }),
  });
}

export function useRemoveItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/shopping-list/items/${id}`, { method: 'DELETE' }),
    onMutate: (id) => patchListCaches(client, (items) => items.filter((item) => item.id !== id)),
    onError: (_error, _id, snapshot) => restore(client, snapshot),
    onSettled: () => client.invalidateQueries({ queryKey: keys.list }),
  });
}

/** Waits for the list to reload, so the screen switches mode only once. */
function useListAction<T>(request: (input: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => client.invalidateQueries({ queryKey: keys.list }),
  });
}

export function useStartShopping() {
  return useListAction((marketId: string | null) =>
    api<ShoppingList>('/shopping-list/start', { method: 'POST', body: { market_id: marketId } }),
  );
}

export function useCancelShopping() {
  return useListAction(() => api<ShoppingList>('/shopping-list/cancel', { method: 'POST' }));
}

export function useSplitRoute() {
  return useListAction((userIds: string[]) =>
    api<ShoppingList>('/shopping-list/split', { method: 'POST', body: { user_ids: userIds } }),
  );
}

/** Finish the purchase: stock goes up, so products reload as well. */
export function useCheckout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<CheckoutResponse>('/shopping-list/checkout', { method: 'POST' }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: keys.list }),
        client.invalidateQueries({ queryKey: keys.products }),
        client.invalidateQueries({ queryKey: keys.purchases }),
        client.invalidateQueries({ queryKey: ['stats'] }),
      ]),
  });
}

// --- Purchases, receipts and figures ----------------------------------------

/** The browser's time zone decides which month a purchase belongs to. */
function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function usePurchases(limit = 100) {
  return useQuery({
    queryKey: keys.purchases,
    queryFn: () => api<PurchaseSummary[]>(`/purchases?limit=${limit}`),
  });
}

export function usePurchase(id: string | null) {
  return useQuery({
    queryKey: keys.purchase(id ?? ''),
    queryFn: () => api<PurchaseDetail>(`/purchases/${id}`),
    enabled: id !== null,
  });
}

export function useSpending(months = 6) {
  return useQuery({
    queryKey: keys.spending(months),
    queryFn: () =>
      api<MonthSpending[]>(`/stats/spending?months=${months}&tz=${encodeURIComponent(timeZone())}`),
  });
}

export function useConsumption(days = 7) {
  return useQuery({
    queryKey: keys.consumption(days),
    queryFn: () => api<ConsumptionSummary>(`/stats/consumption?days=${days}`),
  });
}

export function usePrices(productId: string | null) {
  return useQuery({
    queryKey: keys.prices(productId ?? ''),
    queryFn: () => api<PricePoint[]>(`/products/${productId}/prices`),
    enabled: productId !== null,
  });
}

/** The demo's sample receipt (or a photo read by Claude): a draft, nothing is saved. */
export function useReceiptDraft(purchaseId: string) {
  return useMutation({
    mutationFn: (photo?: { media_type: string; data: string }) =>
      photo
        ? api<ReceiptDraft>(`/purchases/${purchaseId}/receipt/read`, {
            method: 'POST',
            body: photo,
          })
        : api<ReceiptDraft>(`/purchases/${purchaseId}/receipt/sample`),
  });
}

/** Save the reviewed receipt: prices become each product's last price. */
export function useSaveReceipt(purchaseId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ReceiptConfirm) =>
      api<PurchaseDetail>(`/purchases/${purchaseId}/receipt`, { method: 'PUT', body }),
    onSuccess: (detail) => {
      client.setQueryData(keys.purchase(purchaseId), detail);
      return Promise.all([
        client.invalidateQueries({ queryKey: keys.purchases }),
        client.invalidateQueries({ queryKey: ['stats'] }),
        client.invalidateQueries({ queryKey: keys.products }),
        client.invalidateQueries({ queryKey: keys.list }),
      ]);
    },
  });
}

// --- Catalog ---------------------------------------------------------------

export function useCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: () => api<Category[]>('/categories') });
}

export function useCreateCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<Category>('/categories', { method: 'POST', body: { name } }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.categories }),
  });
}

/** Archived products only (the API returns them mixed with the active ones). */
export function useArchivedProducts(enabled: boolean) {
  return useQuery({
    queryKey: keys.archivedProducts,
    queryFn: async () =>
      (await api<Product[]>('/products?include_archived=true')).filter(
        (product) => product.archived_at !== null,
      ),
    enabled,
  });
}

/** Any change to a product can move it on or off the shopping list. */
function useProductAction<T>(request: (input: T) => Promise<Product>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: keys.products }),
        client.invalidateQueries({ queryKey: keys.list }),
      ]),
  });
}

export function useCreateProduct() {
  return useProductAction((body: ProductInput) =>
    api<Product>('/products', { method: 'POST', body }),
  );
}

export function useUpdateProduct() {
  return useProductAction(({ id, changes }: { id: string; changes: Partial<ProductInput> }) =>
    api<Product>(`/products/${id}`, { method: 'PATCH', body: changes }),
  );
}

export function useArchiveProduct() {
  return useProductAction((id: string) =>
    api<Product>(`/products/${id}/archive`, { method: 'POST' }),
  );
}

export function useRestoreProduct() {
  return useProductAction((id: string) =>
    api<Product>(`/products/${id}/restore`, { method: 'POST' }),
  );
}

// --- Markets ---------------------------------------------------------------

export function useArchivedMarkets(enabled: boolean) {
  return useQuery({
    queryKey: keys.archivedMarkets,
    queryFn: async () =>
      (await api<Market[]>('/markets?include_archived=true')).filter(
        (market) => market.archived_at !== null,
      ),
    enabled,
  });
}

function useMarketAction<T>(request: (input: T) => Promise<Market>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => client.invalidateQueries({ queryKey: keys.markets }),
  });
}

export function useCreateMarket() {
  return useMarketAction((body: MarketInput) => api<Market>('/markets', { method: 'POST', body }));
}

export function useUpdateMarket() {
  return useMarketAction(({ id, changes }: { id: string; changes: MarketInput }) =>
    api<Market>(`/markets/${id}`, { method: 'PATCH', body: changes }),
  );
}

export function useArchiveMarket() {
  return useMarketAction((id: string) => api<Market>(`/markets/${id}/archive`, { method: 'POST' }));
}

export function useRestoreMarket() {
  return useMarketAction((id: string) => api<Market>(`/markets/${id}/restore`, { method: 'POST' }));
}

// --- Floor plan ------------------------------------------------------------

export function useLayout(marketId: string | undefined) {
  return useQuery({
    queryKey: keys.layout(marketId ?? ''),
    queryFn: () => api<Layout>(`/markets/${marketId}/layout`),
    enabled: Boolean(marketId),
  });
}

/** Save the whole plan; the shopping list is sorted by it, so it reloads too. */
export function useSaveLayout(marketId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (plan: Plan) =>
      api<Layout>(`/markets/${marketId}/layout`, { method: 'PUT', body: layoutBody(plan) }),
    onSuccess: (layout) => {
      client.setQueryData(keys.layout(marketId), layout);
      return Promise.all([
        client.invalidateQueries({ queryKey: keys.markets, exact: true }),
        client.invalidateQueries({ queryKey: keys.list }),
      ]);
    },
  });
}

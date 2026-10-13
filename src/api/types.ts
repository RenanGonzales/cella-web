/** Shapes returned by cella-api (see the API's /docs). */

export type ProductUnit = 'un' | 'kg' | 'g' | 'l' | 'ml';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/** POST /auth/demo: a private demo household, with Alex's token and Sam's. */
export interface DemoSession extends TokenResponse {
  partner: { id: string; name: string; access_token: string };
}

export interface Member {
  id: string;
  name: string;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  household: { id: string; name: string; invite_code: string; members: Member[] };
  /** What this account can use: the app only shows what works. */
  features: { receipt_ai: boolean; is_demo: boolean };
}

export interface StorageArea {
  id: string;
  name: string;
  position: number;
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  category_id: string;
  storage_area_id: string;
  unit: ProductUnit;
  consume_step: number;
  ideal_quantity: number;
  min_quantity: number;
  current_quantity: number;
  below_ideal: boolean;
  needs_restock: boolean;
  last_price_cents: number | null;
  last_purchased_at: string | null;
  archived_at: string | null;
}

export interface Category {
  id: string;
  name: string;
}

/** Fields of POST /products (all) and PATCH /products/{id} (any). */
export interface ProductInput {
  name: string;
  brand: string | null;
  category_id: string;
  storage_area_id: string;
  unit: ProductUnit;
  consume_step: number;
  ideal_quantity: number;
  min_quantity: number;
  current_quantity: number;
}

export interface MarketInput {
  name: string;
  chain: string | null;
  address: string | null;
}

export interface ConsumeResponse {
  product: Product;
  consumption_event_id: string | null;
  consumed: number;
  added_to_list: boolean;
}

export interface UndoResponse {
  product: Product;
  restored: number;
}

export type ItemStatus = 'pending' | 'checked' | 'not_found';

export interface ShoppingListItem {
  id: string;
  product_id: string;
  name: string;
  brand: string | null;
  category: string;
  unit: ProductUnit;
  quantity_needed: number;
  quantity_bought: number | null;
  status: ItemStatus;
  added_manually: boolean;
  assigned_user_id: string | null;
  last_price_cents: number | null;
  /** The product's stock: why the item is on the list and how much is enough. */
  current_quantity: number;
  min_quantity: number;
  ideal_quantity: number;
}

export interface ShoppingListGroup {
  /** Null for the "Other" group (category not mapped to a corridor). */
  corridor_id: string | null;
  name: string;
  items: ShoppingListItem[];
}

export interface ShoppingList {
  id: string | null;
  status: 'open' | 'shopping' | 'archived' | null;
  market_id: string | null;
  sorted_by_market_id: string | null;
  item_count: number;
  groups: ShoppingListGroup[];
}

/** Fields of PATCH /shopping-list/items/{id}; send only what changes. */
export interface ItemChanges {
  quantity_needed?: number;
  status?: ItemStatus;
  quantity_bought?: number;
  assigned_user_id?: string | null;
}

export interface Market {
  id: string;
  name: string;
  chain: string | null;
  address: string | null;
  corridor_count: number;
  has_plan: boolean;
  archived_at: string | null;
}

export interface CheckoutResponse {
  purchase_id: string;
  items_bought: number;
  items_carried_over: number;
  total_cents: number;
  items_without_price: number;
}

// --- Purchases and receipts -----------------------------------------------

export type ReceiptSource = 'sample' | 'ai' | 'manual';

export interface PurchaseSummary {
  id: string;
  market_id: string | null;
  market_name: string | null;
  started_at: string | null;
  completed_at: string;
  items_bought: number;
  items_without_price: number;
  total_cents: number;
  receipt_source: ReceiptSource | null;
  receipt_total_cents: number | null;
  /** The receipt's total when there is one, else the sum of priced items. */
  paid_cents: number;
}

export interface PurchaseItem {
  id: string;
  product_id: string;
  name: string;
  brand: string | null;
  unit: ProductUnit;
  status: ItemStatus;
  quantity_bought: number | null;
  unit_price_cents: number | null;
  line_total_cents: number | null;
}

export interface PurchaseDetail extends PurchaseSummary {
  items: PurchaseItem[];
}

export interface ReceiptLine {
  text: string;
  quantity: number | null;
  unit_price_cents: number | null;
  line_total_cents: number | null;
  /** Suggested product of the household; null when the line is not a product. */
  product_id: string | null;
  previous_price_cents: number | null;
}

/** A receipt read from a photo, or the demo's sample. Nothing is saved until confirmed. */
export interface ReceiptDraft {
  source: ReceiptSource;
  store_name: string | null;
  purchased_on: string | null;
  total_cents: number | null;
  lines: ReceiptLine[];
}

export interface ReceiptConfirm {
  source: ReceiptSource;
  total_cents: number | null;
  prices: { product_id: string; unit_price_cents: number }[];
}

// --- Figures ---------------------------------------------------------------

export interface MonthSpending {
  /** YYYY-MM */
  month: string;
  paid_cents: number;
  purchases: number;
}

export interface ConsumptionSummary {
  days: number;
  times: number;
  products: {
    product_id: string;
    name: string;
    unit: ProductUnit;
    quantity: number;
    times: number;
  }[];
}

export interface PricePoint {
  purchase_id: string;
  purchased_at: string;
  market_name: string | null;
  unit_price_cents: number;
}
